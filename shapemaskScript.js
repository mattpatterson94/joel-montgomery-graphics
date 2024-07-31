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

    function handleFiles(files) {
        if (files.length > 0) {
            const file = files[0];
            const originalFileName = file.name;
    
            // Check if the file is an SVG by checking the extension and MIME type
            const fileExtension = originalFileName.split('.').pop().toLowerCase();
            const fileType = file.type;
    
            if (fileExtension !== 'svg' || fileType !== 'image/svg+xml') {
                alertMessageNonSvg.classList.remove('advanced-toggle');
                console.log('failed')

                setTimeout(() => {
                    alertMessageNonSvg.classList.add('advanced-toggle');
                }, 3000); // Delay in milliseconds
                console.log('Error: Only SVG files are allowed.');
                return;
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

        try {
            let output = $.parseHTML(svgText);

            $(output).find('clipPath').children().each(function () {
                $(this).removeAttr('fill');
            });

            $(output).find('defs').children().unwrap();

            let targetGroup = $(output).find('rect').closest('g');
            targetGroup.attr('id', 'clip_1');

            targetGroup.parent().parent().replaceWith(targetGroup);

            let rect = $(output).find('rect');
            let width = rect.attr('width');
            let height = rect.attr('height');
            rect.remove();

            targetGroup.html('<image overflow="visible" x="0" y="0" width="' + width + '" height="' + height + '" xlink:href=""/>');

            let outputHTML = $(output)
                .find('g')
                .parent()
                .prop('outerHTML')
                .replaceAll('image', 'image')
                .replaceAll('/image>', '/image></g>')
                .replaceAll('<clipPath', '<g><clipPath');

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
        } catch (error) {
            hasError = true;
            alertMessageSvg.classList.remove('advanced-toggle');
            console.log('failed')

            setTimeout(() => {
                alertMessageSvg.classList.add('advanced-toggle');
            }, 3000); // Delay in milliseconds
        }
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
        var element = document.getElementById('inputs-hider');
        var element2 = document.getElementById('buttons-simple');
        var element3 = document.getElementById('buttons-advanced');
        var element4 = document.getElementById('simple-explainer');
        var element5 = document.getElementById('advanced-explainer');
        var element6 = document.getElementById('upload-hider');

        element.classList.remove('advanced-toggle');
        element2.classList.add('advanced-toggle');
        element3.classList.remove('advanced-toggle');
        element4.classList.add('advanced-toggle');
        element5.classList.remove('advanced-toggle');
        element6.classList.add('advanced-toggle');

        toggleCopyButtonState()
    });

    $('#mode-switcher-2').click(function() {
        var element = document.getElementById('inputs-hider');
        var element2 = document.getElementById('buttons-simple');
        var element3 = document.getElementById('buttons-advanced');
        var element4 = document.getElementById('simple-explainer');
        var element5 = document.getElementById('advanced-explainer');
        var element6 = document.getElementById('upload-hider');

        element.classList.add('advanced-toggle');
        element2.classList.remove('advanced-toggle');
        element3.classList.add('advanced-toggle');
        element4.classList.remove('advanced-toggle');
        element5.classList.add('advanced-toggle');
        element6.classList.remove('advanced-toggle');
    });


    // Function for Advanced Submit button
    $('#submit-button-2').click(function() {
        var hasError = false;

        try {
            var input = $('#input').val();
            var output = $.parseHTML(input);
        
            var defs = $(output).find('defs');
        
            $(output).find('clipPath').html(defs.html());
            $(output).find('clipPath').attr("id", "SVGID_2_");
            $(output).find('defs').remove();
            var rect =  $(output).find('g').find('rect');
            var width = rect.attr('width');
            var height = rect.attr('height');
            $(output).find('g').find('rect').remove();
            $(output).find('g').append('<g id="clip_1" clip-path="url(#SVGID_2_)"></g>')
            $(output).find('g').find('g').html('<image1 overflow="visible" x="0" y="0" width="'+width+'" height="'+height+'" xlink:href=""/>');
            var outputHTML = $(output)
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
            var element1 = document.getElementById('alert-message-simple');
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
    var copyText = document.getElementById("output");
  
    // Select the text field
    copyText.select();
    copyText.setSelectionRange(0, 99999); // For mobile devices
  
     // Copy the text inside the text field
    navigator.clipboard.writeText(copyText.value);

    // toggle button clicked
    var copyButton = document.getElementById('copy-button-content');
    copyButton.classList.toggle('clicked');

    // toggle button unlclicked after delay
    setTimeout(() => {
        var copyButton = document.getElementById('copy-button-content');
        copyButton.classList.toggle('clicked');
    }, 1000); // Delay in milliseconds
  }
