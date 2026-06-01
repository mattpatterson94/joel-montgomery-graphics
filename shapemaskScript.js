function showTimedAlert(element) {
    if (!element) return;

    element.classList.remove('advanced-toggle');

    setTimeout(() => {
        element.classList.add('advanced-toggle');
    }, 3000);
}

function getViewBoxNumbers(svgElement) {
    const viewBox = svgElement.getAttribute('viewBox');

    if (!viewBox) return null;

    const numbers = viewBox
        .trim()
        .split(/[\s,]+/)
        .map(Number);

    if (numbers.length !== 4 || numbers.some(Number.isNaN)) {
        return null;
    }

    return {
        x: numbers[0],
        y: numbers[1],
        width: numbers[2],
        height: numbers[3]
    };
}

function cleanClipShape(shapeElement) {
    const attributesToRemove = [
        'fill',
        'stroke',
        'class',
        'style',
        'isolation',
        'mix-blend-mode',
        'opacity',
        'filter',
        'mask',
        'clip-path'
    ];

    attributesToRemove.forEach(attr => {
        shapeElement.removeAttribute(attr);
    });

    // Remove Illustrator/Adobe namespaced attributes if present
    Array.from(shapeElement.attributes).forEach(attr => {
        if (
            attr.name.startsWith('data-') ||
            attr.name.startsWith('sodipodi:') ||
            attr.name.startsWith('inkscape:')
        ) {
            shapeElement.removeAttribute(attr.name);
        }
    });

    return shapeElement;
}

function copyOnlyShapeGeometry(originalShape, doc) {
    const tagName = originalShape.tagName.toLowerCase();
    const cleanShape = doc.createElementNS('http://www.w3.org/2000/svg', tagName);

    const geometryAttributes = [
        'd',
        'points',
        'x',
        'y',
        'x1',
        'y1',
        'x2',
        'y2',
        'cx',
        'cy',
        'r',
        'rx',
        'ry',
        'width',
        'height',
        'transform',
        'fill-rule',
        'clip-rule'
    ];

    geometryAttributes.forEach(attr => {
        if (originalShape.hasAttribute(attr)) {
            cleanShape.setAttribute(attr, originalShape.getAttribute(attr));
        }
    });

    return cleanShape;
}

function getRenderedBBox(svgText) {
    return new Promise((resolve, reject) => {
        const container = document.createElement('div');

        container.style.position = 'absolute';
        container.style.visibility = 'hidden';
        container.style.pointerEvents = 'none';
        container.style.left = '-99999px';
        container.style.top = '-99999px';

        document.body.appendChild(container);
        container.innerHTML = svgText;

        requestAnimationFrame(() => {
            try {
                const svgContainer = container.querySelector('svg');

                if (!svgContainer) {
                    throw new Error('SVG container element not found.');
                }

                const shapeForBbox = svgContainer.querySelector('path, polygon, rect, circle, ellipse');

                if (!shapeForBbox) {
                    throw new Error('No supported shape found for bounding box calculation.');
                }

                const bbox = shapeForBbox.getBBox();

                container.remove();

                resolve({
                    x: bbox.x,
                    y: bbox.y,
                    width: bbox.width,
                    height: bbox.height
                });

            } catch (error) {
                container.remove();
                reject(error);
            }
        });
    });
}

async function transformSvgToClipImage(svgText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');

    const parserError = doc.querySelector('parsererror');

    if (parserError) {
        throw new Error('Invalid SVG/XML.');
    }

    const svgElement = doc.querySelector('svg');

    if (!svgElement) {
        throw new Error('SVG element not found.');
    }

    const originalShape = svgElement.querySelector('path, polygon, rect, circle, ellipse');

    if (!originalShape) {
        throw new Error('No supported shape found. Expected path, polygon, rect, circle, or ellipse.');
    }

    const bbox = await getRenderedBBox(svgText);

    const viewBox = getViewBoxNumbers(svgElement);

    // Add width/height if Illustrator omitted them.
    // Some downstream tools need these explicit attributes.
    if (!svgElement.hasAttribute('width')) {
        if (viewBox) {
            svgElement.setAttribute('width', viewBox.width);
        } else {
            svgElement.setAttribute('width', bbox.width);
        }
    }

    if (!svgElement.hasAttribute('height')) {
        if (viewBox) {
            svgElement.setAttribute('height', viewBox.height);
        } else {
            svgElement.setAttribute('height', bbox.height);
        }
    }

    svgElement.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

    // Create a clean clipPath with the actual shape directly inside it.
    // This avoids broken output like:
    // <clipPath><g id="Layer_1-2"><path .../></g></clipPath>
    const clipPathElement = doc.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
    clipPathElement.setAttribute('id', 'clippath');

    let cleanShape = copyOnlyShapeGeometry(originalShape, doc);
    cleanShape = cleanClipShape(cleanShape);

    clipPathElement.appendChild(cleanShape);

    const clipGroup = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
    clipGroup.setAttribute('clip-path', 'url(#clippath)');
    clipGroup.setAttribute('id', 'clip_1');

    const imageElement = doc.createElementNS('http://www.w3.org/2000/svg', 'image');
    imageElement.setAttribute('overflow', 'visible');
    imageElement.setAttribute('x', bbox.x);
    imageElement.setAttribute('y', bbox.y);
    imageElement.setAttribute('width', bbox.width);
    imageElement.setAttribute('height', bbox.height);
    imageElement.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '');

    clipGroup.appendChild(imageElement);

    const wrapper = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
    wrapper.appendChild(clipPathElement);
    wrapper.appendChild(clipGroup);

    // Clear all original Illustrator content:
    // defs, styles, empty cls groups, nested layer groups, comments, etc.
    while (svgElement.firstChild) {
        svgElement.removeChild(svgElement.firstChild);
    }

    svgElement.appendChild(wrapper);

    const serializer = new XMLSerializer();

    let outputHTML = serializer.serializeToString(doc);

    // Keep clipPath casing safe for tools that are picky.
    outputHTML = outputHTML
        .replaceAll('clippath>', 'clipPath>')
        .replaceAll('<clippath', '<clipPath');

    return outputHTML;
}

function downloadSvg(outputHTML, originalFileName) {
    const baseName = originalFileName.replace(/\.[^/.]+$/, '');
    const processedFileName = `${baseName}-processed.svg`;

    const blob = new Blob([outputHTML], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = processedFileName;
    a.click();

    URL.revokeObjectURL(url);
}


document.addEventListener('DOMContentLoaded', () => {
    const dropArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('file-input');
    const submitButtonContent = document.getElementById('submit-button-content');
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

    async function handleFiles(files) {
        for (const file of files) {
            const originalFileName = file.name;
            const fileExtension = originalFileName.split('.').pop().toLowerCase();

            // Some browsers return an empty MIME type for SVGs,
            // so extension check is more reliable here.
            if (fileExtension !== 'svg') {
                showTimedAlert(alertMessageNonSvg);
                console.log('Error: Only SVG files are allowed.');
                continue;
            }

            const reader = new FileReader();

            reader.onload = async (e) => {
                try {
                    const svgText = e.target.result;
                    const outputHTML = await transformSvgToClipImage(svgText);

                    const outputField = document.getElementById('output');
                    outputField.value = outputHTML;
                    outputField.dispatchEvent(new Event('input'));

                    downloadSvg(outputHTML, originalFileName);

                    submitButtonContent.classList.toggle('clicked');

                    setTimeout(() => {
                        submitButtonContent.classList.toggle('clicked');
                    }, 1000);

                } catch (error) {
                    console.error('Error processing SVG:', error);
                    showTimedAlert(alertMessageSvg);
                }
            };

            reader.readAsText(file);
        }
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
    $('#submit-button-2').click(async function () {
        const alertMessageSimple = document.getElementById('alert-message-simple');

        try {
            const input = $('#input').val();
            const outputHTML = await transformSvgToClipImage(input);

            $('#output').val(outputHTML);
            $('#output').trigger('input');

        } catch (error) {
            console.error('Error processing advanced SVG:', error);
            showTimedAlert(alertMessageSimple);
        }
    });
});


function copyOutput() {
    const copyText = document.getElementById('output');

    copyText.select();
    copyText.setSelectionRange(0, 99999);

    navigator.clipboard.writeText(copyText.value);

    const copyButton = document.getElementById('copy-button-content');
    copyButton.classList.toggle('clicked');

    setTimeout(() => {
        const copyButton = document.getElementById('copy-button-content');
        copyButton.classList.toggle('clicked');
    }, 1000);
}
