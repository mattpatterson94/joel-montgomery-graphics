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
        } else {
            $('#submit-button').prop('disabled', false);
        }
    }

    // Function to toggle button state
    function toggleCopyButtonState() {
        if ($('#output').val().trim() === '') {
            $('#copy-button').prop('disabled', true);
        } else {
            $('#copy-button').prop('disabled', false);
        }
    }


    // Existing click event listener for the button
    $('button').click(function() {
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
    var button = document.getElementById('copy-button-content');
    button.classList.toggle('clicked');
  }
