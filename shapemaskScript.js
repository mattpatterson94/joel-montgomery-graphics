document.addEventListener('DOMContentLoaded', () => {
    const dropArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('file-input');
    const submitButtonContent = document.getElementById('submit-button-content');
    const submitButton = document.getElementById('submit-button');
    const alertMessageSvg = document.getElementById('alert-message-svg-fail');
    const alertMessageNonSvg = document.getElementById('alert-message-non-svg');

    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // Highlight the drop area when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => {
            dropArea.classList.add('highlight');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => {
            dropArea.classList.remove('highlight');
        }, false);
    });

    // Handle dropped files
    dropArea.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        handleFiles(files);
    });

    // Handle file input change
    fileInput.addEventListener('change', (e) => {
        const files = e.target.files;
        handleFiles(files);
    });

    // Trigger file input when clicking the drop area
    dropArea.addEventListener('click', () => {
        fileInput.click();
    });

    function showSvgError(error) {
        console.error('Error processing SVG:', error);

        alertMessageSvg.classList.remove('advanced-toggle');

        setTimeout(() => {
            alertMessageSvg.classList.add('advanced-toggle');
        }, 3000);
    }

    function handleFiles(files) {
        for (const file of files) {
            const originalFileName = file.name;
            const fileExtension = originalFileName.split('.').pop().toLowerCase();
            const fileType = file.type;

            if (fileExtension !== 'svg' || fileType !== 'image/svg+xml') {
                alertMessageNonSvg.classList.remove('advanced-toggle');
                console.log('failed');

                setTimeout(() => {
                    alertMessageNonSvg.classList.add('advanced-toggle');
                }, 3000);

                console.log('Error: Only SVG files are allowed.');
                continue;
            }

            const reader = new FileReader();

            reader.onload = (e) => {
                const svgText = e.target.result;
                processFiles(svgText, originalFileName);
            };

            reader.readAsText(file);
        }
    }

    function processFiles(svgText, originalFileName) {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(svgText, 'image/svg+xml');
            const svgElement = doc.querySelector('svg');

            if (!svgElement) {
                throw new Error('SVG element not found.');
            }

            // Catch XML parser errors
            const parserError = doc.querySelector('parsererror');
            if (parserError) {
                throw new Error('Invalid SVG/XML.');
            }

            // Create an SVG container for accurate bounding box calculation
            const container = document.createElement('div');
            container.style.position = 'absolute';
            container.style.visibility = 'hidden';
            container.style.pointerEvents = 'none';
            container.style.left = '-99999px';
            container.style.top = '-99999px';
            document.body.appendChild(container);
            container.innerHTML = svgText;

            const svgContainer = container.querySelector('svg');

            if (!svgContainer) {
                document.body.removeChild(container);
                throw new Error('SVG container element not found.');
            }

            // Ensure that elements are fully rendered before calculating bbox
            requestAnimationFrame(() => {
                try {
                    const shapeForBbox = svgContainer.querySelector('path, polygon');

                    let xcoordsvg, ycoordsvg, widthsvg, heightsvg;

                    if (shapeForBbox) {
                        const bbox = shapeForBbox.getBBox();
                        xcoordsvg = bbox.x;
                        ycoordsvg = bbox.y;
                        widthsvg = bbox.width;
                        heightsvg = bbox.height;
                    } else {
                        throw new Error('No path or polygon found for bounding box calculation.');
                    }

                    // Clean up temporary render container
                    document.body.removeChild(container);

                    // Remove defs if present
                    const defs = svgElement.querySelector('defs');
                    if (defs) {
                        defs.parentNode.removeChild(defs);
                    }

                    wrapInGroup(svgElement);

                    let layer1Group = svgElement.querySelector('g[id]');

                    if (layer1Group) {
                        // Extract the inner HTML of the <g> element
                        let innerContent = layer1Group.innerHTML;

                        // Replace the <g> element with <clipPath> element
                        let clipPathElement = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
                        clipPathElement.setAttribute('id', 'clippath');
                        clipPathElement.innerHTML = innerContent;

                        // Replace the original <g> with the new <clipPath>
                        layer1Group.parentNode.replaceChild(clipPathElement, layer1Group);

                        // Find the <path> or <polygon> element inside the new <clipPath>
                        let shapeElement = clipPathElement.querySelector('path, polygon');

                        if (shapeElement) {
                            // Remove visual/style attributes that are not needed inside the clip path
                            shapeElement.removeAttribute('fill');
                            shapeElement.removeAttribute('class');
                            shapeElement.removeAttribute('stroke');
                            shapeElement.removeAttribute('style');

                            // Remove blend/isolation attributes from the clip path shape
                            shapeElement.removeAttribute('isolation');
                            shapeElement.removeAttribute('mix-blend-mode');

                            // Create a new <g> element with specified properties
                            let newGElement = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                            newGElement.setAttribute('clip-path', 'url(#clippath)');
                            newGElement.setAttribute('id', 'clip_1');

                            // Insert the new <g> element after the <clipPath> element
                            clipPathElement.parentNode.insertBefore(newGElement, clipPathElement.nextSibling);

                            // Create a new <image> element with specified properties
                            let imageElement = document.createElementNS('http://www.w3.org/2000/svg', 'image');
                            imageElement.setAttribute('overflow', 'visible');
                            imageElement.setAttribute('x', xcoordsvg);
                            imageElement.setAttribute('y', ycoordsvg);
                            imageElement.setAttribute('width', widthsvg);
                            imageElement.setAttribute('height', heightsvg);
                            imageElement.setAttribute('xlink:href', '');

                            // Append the new <image> element inside the <g id="clip_1">
                            newGElement.appendChild(imageElement);
                        }
                    } else {
                        throw new Error('No layer group found.');
                    }

                    // Add xmlns:xlink attribute to <svg>
                    svgElement.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

                    // Always wrap <clipPath> and <g id="clip_1"> inside a new <g>
                    (function () {
                        const clipPath = svgElement.querySelector('clipPath');
                        const clipGroup = svgElement.querySelector('g[id="clip_1"]');

                        if (!clipPath && !clipGroup) return;

                        // Create wrapper <g>
                        const wrapper = document.createElementNS('http://www.w3.org/2000/svg', 'g');

                        if (clipPath) {
                            // Important fix:
                            // clipPath may be nested inside another group, e.g. <g isolation="isolate">
                            clipPath.parentNode.removeChild(clipPath);
                            wrapper.appendChild(clipPath);
                        }

                        if (clipGroup) {
                            // Important fix:
                            // clipGroup may also be nested inside another group
                            clipGroup.parentNode.removeChild(clipGroup);
                            wrapper.appendChild(clipGroup);
                        }

                        svgElement.appendChild(wrapper);
                    })();

                    // Generate the modified SVG output
                    const serializer = new XMLSerializer();
                    let outputHTML = serializer.serializeToString(doc);

                    // Manually replace both opening and closing <clippath> tags with <clipPath>
                    outputHTML = outputHTML
                        .replaceAll('clippath>', 'clipPath>')
                        .replaceAll('<clippath', '<clipPath');

                    document.getElementById('output').value = outputHTML;

                    // Modify the original filename to append "-processed"
                    const baseName = originalFileName.replace(/\.[^/.]+$/, '');
                    const processedFileName = `${baseName}-processed.svg`;

                    // Create a Blob and a download link
                    const blob = new Blob([outputHTML], { type: 'image/svg+xml' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = processedFileName;
                    a.click();
                    URL.revokeObjectURL(url);

                    submitButtonContent.classList.toggle('clicked');

                    setTimeout(() => {
                        submitButtonContent.classList.toggle('clicked');
                    }, 1000);

                } catch (error) {
                    if (container && container.parentNode) {
                        container.parentNode.removeChild(container);
                    }

                    showSvgError(error);
                }
            });

        } catch (error) {
            showSvgError(error);
        }
    }

    // Function to wrap elements in <g> if not already wrapped and assign an ID to the new <g>
    function wrapInGroup(svgElement) {
        const elements = svgElement.querySelectorAll('path, polygon');

        elements.forEach((element, index) => {
            if (element.parentElement.tagName.toLowerCase() !== 'g') {
                const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                g.id = `Layer_${index + 1}`;
                element.parentNode.insertBefore(g, element);
                g.appendChild(element);
            }
        });
    }
});


$(document).ready(function () {
    // Initial button state based on textarea content
    toggleButtonState();
    toggleCopyButtonState();

    // Event listener for textarea input to enable/disable the button
    $('#input').on('input', function () {
        toggleButtonState();
    });

    $('#output').on('input', function () {
        toggleCopyButtonState();
    });

    // Function to toggle button state
    function toggleButtonState() {
        if ($('#input').val().trim() === '') {
            $('#submit-button').prop('disabled', true);
            $('#submit-button-2').prop('disabled', true);
        } else {
            $('#submit-button').prop('disabled', false);
            $('#submit-button-2').prop('disabled', false);
        }
    }

    // Function to toggle Copy button state
    function toggleCopyButtonState() {
        if ($('#output').val().trim() === '') {
            $('#copy-button').prop('disabled', true);
        } else {
            $('#copy-button').prop('disabled', false);
        }
    }

    // Function to toggle advanced mode
    $('#mode-switcher').click(function () {
        const element = document.getElementById('inputs-hider');
        const element2 = document.getElementById('buttons-simple');
        const element3 = document.getElementById('buttons-advanced');
        const element4 = document.getElementById('simple-explainer');
        const element5 = document.getElementById('advanced-explainer');
        const element6 = document.getElementById('upload-hider');

        element.classList.remove('advanced-toggle');
        element2.classList.add('advanced-toggle');
        element3.classList.remove('advanced-toggle');
        element4.classList.add('advanced-toggle');
        element5.classList.remove('advanced-toggle');
        element6.classList.add('advanced-toggle');

        toggleCopyButtonState();
    });

    $('#mode-switcher-2').click(function () {
        const element = document.getElementById('inputs-hider');
        const element2 = document.getElementById('buttons-simple');
        const element3 = document.getElementById('buttons-advanced');
        const element4 = document.getElementById('simple-explainer');
        const element5 = document.getElementById('advanced-explainer');
        const element6 = document.getElementById('upload-hider');

        element.classList.add('advanced-toggle');
        element2.classList.remove('advanced-toggle');
        element3.classList.add('advanced-toggle');
        element4.classList.remove('advanced-toggle');
        element5.classList.add('advanced-toggle');
        element6.classList.remove('advanced-toggle');
    });

    // Function for Advanced Submit button
    $('#submit-button-2').click(function () {
        let hasError = false;

        try {
            const input = $('#input').val();
            let output = $.parseHTML(input);

            let defs = $(output).find('defs');

            $(output).find('clipPath').html(defs.html());
            $(output).find('clipPath').attr('id', 'SVGID_2_');
            $(output).find('defs').remove();

            let rect = $(output).find('g').find('rect');
            let width = rect.attr('width');
            let height = rect.attr('height');

            $(output).find('g').find('rect').remove();
            $(output).find('g').append('<g id="clip_1" clip-path="url(#SVGID_2_)"></g>');
            $(output).find('g').find('g').html('<image1 overflow="visible" x="0" y="0" width="' + width + '" height="' + height + '" xlink:href=""/>');

            let outputHTML = $(output)
                .find('g')
                .parent()
                .prop('outerHTML')
                .replaceAll('image1', 'image');

            $('#output').val(outputHTML);
            toggleCopyButtonState();

        } catch (error) {
            hasError = true;
            console.error('Error processing advanced SVG:', error);
        }

        if (hasError) {
            const element1 = document.getElementById('alert-message-simple');
            element1.classList.remove('advanced-toggle');

            setTimeout(() => {
                element1.classList.add('advanced-toggle');
            }, 3000);
        }
    });
});


function copyOutput() {
    // Get the text field
    let copyText = document.getElementById('output');

    // Select the text field
    copyText.select();
    copyText.setSelectionRange(0, 99999); // For mobile devices

    // Copy the text inside the text field
    navigator.clipboard.writeText(copyText.value);

    // Toggle button clicked
    const copyButton = document.getElementById('copy-button-content');
    copyButton.classList.toggle('clicked');

    // Toggle button unclicked after delay
    setTimeout(() => {
        const copyButton = document.getElementById('copy-button-content');
        copyButton.classList.toggle('clicked');
    }, 1000);
}
