jQuery('button').click(function() {
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
});
