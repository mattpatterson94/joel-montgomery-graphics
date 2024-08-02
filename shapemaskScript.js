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

    function handleFiles(files) {
        for (const file of files) {
            const originalFileName = file.name;

            // Check if the file is an SVG by checking the extension and MIME type
            const fileExtension = originalFileName.split('.').pop().toLowerCase();
            const fileType = file.type;

            if (fileExtension !== 'svg' || fileType !== 'image/svg+xml') {
                alertMessageNonSvg.classList.remove('advanced-toggle');
                console.log('failed');

                setTimeout(() => {
                    alertMessageNonSvg.classList.add('advanced-toggle');
                }, 3000); // Delay in milliseconds
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
        let hasError = false;

/*         try {     */        
            // Get the SVG snippet from the input textarea
            const input = svgText;

            // Parse the input and create a DOM element
            let parser = new DOMParser();
            let doc = parser.parseFromString(input, "image/svg+xml");

            // Find the <svg> element
            let svgElement = doc.querySelector('svg');

            if (svgElement) {
                // Add xmlns:xlink attribute to <svg>
                svgElement.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

                let layer1Group = svgElement.querySelector('g#Layer_1');

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
                        // Remove the 'fill' attribute
                        shapeElement.removeAttribute('fill');

                        // Get the bounding box of the element
                        let shapeBBox = shapeElement.getBBox();
                        let smallestX = shapeBBox.x;
                        let smallestY = shapeBBox.y;
                        let width = shapeBBox.width;
                        let height = shapeBBox.height;

                        // Create a new <g> element with specified properties
                        let newGElement = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                        newGElement.setAttribute('clip-path', 'url(#clippath)');
                        newGElement.setAttribute('id', 'clip_1');

                        // Insert the new <g> element after the <clipPath> element
                        clipPathElement.parentNode.insertBefore(newGElement, clipPathElement.nextSibling);

                        // Create a new <image> element with specified properties
                        let imageElement = document.createElementNS('http://www.w3.org/2000/svg', 'image');
                        imageElement.setAttribute('overflow', 'visible');
                        imageElement.setAttribute('x', smallestX);
                        imageElement.setAttribute('y', smallestY);
                        imageElement.setAttribute('width', width);
                        imageElement.setAttribute('height', height);
                        imageElement.setAttribute('xlink:href', '');

                        // Append the new <image> element inside the <g id="clip_1">
                        newGElement.appendChild(imageElement);
                    }
                }
            }

            // Generate the modified SVG output
            let serializer = new XMLSerializer();
            let outputHTML = serializer.serializeToString(doc);

            // Manually replace both opening and closing <clippath> tags with <clipPath>
            outputHTML = outputHTML
            .replaceAll('clippath>', 'clipPath>')
            .replaceAll('<clippath', '<clipPath');

            // Set the modified SVG into the output textarea
            document.getElementById('output').value = outputHTML;

        
            // Modify the original filename to append "-processed"
            const baseName = originalFileName.replace(/\.[^/.]+$/, ""); // Remove file extension
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
            }, 1000); // Delay in milliseconds
/*         } catch (error) {
            hasError = true;
            alertMessageSvg.classList.remove('advanced-toggle');
            console.log('failed');

            setTimeout(() => {
                alertMessageSvg.classList.add('advanced-toggle');
            }, 3000); // Delay in milliseconds
        } */
    }
});

$(document).ready(function() {
    // Initial button state based on textarea content
    toggleButtonState();
    toggleCopyButtonState();

    // Event listener for textarea input to enable/disable the button
    $('#input').on('input', function() {
        toggleButtonState();
    });
    $('#output').on('input', function() {
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
    $('#mode-switcher').click(function() {
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

        toggleCopyButtonState()
    });

    $('#mode-switcher-2').click(function() {
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
    $('#submit-button-2').click(function() {
        let hasError = false;

        try {
            const input = $('#input').val();
            let output = $.parseHTML(input);
        
            let defs = $(output).find('defs');
        
            $(output).find('clipPath').html(defs.html());
            $(output).find('clipPath').attr("id", "SVGID_2_");
            $(output).find('defs').remove();
            let rect =  $(output).find('g').find('rect');
            let width = rect.attr('width');
            let height = rect.attr('height');
            $(output).find('g').find('rect').remove();
            $(output).find('g').append('<g id="clip_1" clip-path="url(#SVGID_2_)"></g>')
            $(output).find('g').find('g').html('<image1 overflow="visible" x="0" y="0" width="'+width+'" height="'+height+'" xlink:href=""/>');
            let outputHTML = $(output)
                .find('g')
                .parent()
                .prop('outerHTML')
                .replaceAll('image1', 'image');
            $('#output').val(outputHTML);
            toggleCopyButtonState();
        } catch (error) {
            hasError = true;
        }

        if (!hasError) {
        } else {
            const element1 = document.getElementById('alert-message-simple');
            element1.classList.remove('advanced-toggle');
 
            // toggle button unlclicked fail after delay
            setTimeout(() => {
                element1.classList.add('advanced-toggle');
            }, 3000); // Delay in milliseconds
        }
    });
});


function copyOutput() {
    // Get the text field
    let copyText = document.getElementById("output");
  
    // Select the text field
    copyText.select();
    copyText.setSelectionRange(0, 99999); // For mobile devices
  
     // Copy the text inside the text field
    navigator.clipboard.writeText(copyText.value);

    // toggle button clicked
    const copyButton = document.getElementById('copy-button-content');
    copyButton.classList.toggle('clicked');

    // toggle button unlclicked after delay
    setTimeout(() => {
        const copyButton = document.getElementById('copy-button-content');
        copyButton.classList.toggle('clicked');
    }, 1000); // Delay in milliseconds
  }
