function perfectFit(textId="", minFontSize="1em", verticalSpacing="20px", DEBUG=false){
    
    function debug(msg){
        if (DEBUG){ console.log(msg); }
    }   
    debug("Running perfectFit with DEBUG = true.");
    debug("textId=" + textId 
       + " minFontSize=" + minFontSize + " verticalSpacing=" + verticalSpacing);
    // get heading element
    var elem = document.getElementById(textId);
    // save its' contents (should be text only)
    var text = elem.innerHTML;
    // if there is no getComputedStyle, this library won't work.
    if(!document.defaultView.getComputedStyle) {
    throw("ERROR: 'document.defaultView.getComputedStyle' not found. This library only works in browsers that can report computed CSS values.");
    }
    // get its' styles
    var styles = window.getComputedStyle(elem); // TODO in IE it is element.currentStyle
    debug("font-family: " + styles['font-family']);
    // split its' contents into words
    var words = text.split(/\s+/);
    // prepare to process individual words
    var wordSpacingPercent = 0.5; // arbitrary
    var wordSpacingPixels = 5; // arbitrary
    var outerWidth = 100 + 2 * wordSpacingPercent;
    var negativeMargin = -wordSpacingPercent;
    var wordMargin = 1 / (1/wordSpacingPercent + 2/100);
    // get styles
    var fontFamily = styles["font-family"];//styles.getPropertyValue(property);
    var fontWeight = styles["font-weight"];
    var textColor = styles["color"];
    var textDecoration = styles["text-decoration"]; // this isn't inherited?
    //var textShadow = styles["text-shadow"]; // this is inherited
    // prepare for iteratiion
    var svgs = "";
    var wordWidth, wordHeight, wordDescent, wordXOffset;
    for (var word of words){ 
        // Get the metrics of each word
        [wordWidth, wordHeight, wordDescent, wordXOffset] = getStringWidthHeight(word, minFontSize, styles);
        // create an SVG for each word
        svgs += "<div style='margin-top: " + verticalSpacing + "; "
                      + "margin-left: calc(" + wordMargin + "% + " + wordSpacingPixels + "px); "
                      + "margin-right: calc(" + wordMargin + "% + " + wordSpacingPixels + "px); "
                      + "line-height: 0; " // stops divs adding space between svgs
                      + "min-width:" + wordWidth + "px; " // necessary???
                      + "flex-basis:"+ wordWidth + "px; " // necessary???
                      + "flex-grow:" + wordWidth + ";'>" // proportional to the length of the word :)
                + "<svg viewBox='0 0 " + wordWidth + " " + (wordHeight-wordDescent) + "' "
                     + "style='width:100%; overflow:visible;' >" // first SVG is actual word font-weight='"+fontWeight+"' font-family='"+fontFamily+"' 
                        + "<text x='"+(-wordXOffset)+"' y='"+(wordHeight-wordDescent)+"' font-size='"+minFontSize+"' font-weight='"+fontWeight+"' fill='"+textColor+"' text-decoration='"+textDecoration+"' dominant-baseline='baseline' >" + word 
                        + "</text></svg>"
                + (wordDescent>0 ? "<svg viewBox='0 0 " + wordWidth + " " + wordDescent + "' "  // second SVG fills out the height
                     + "style='width:100%; background-color:blue; visibility:hidden;' >"
                        + "</svg>" : "")
                + "</div>";
    }
    // replace elem's contents with svgs
    elem.innerHTML = svgs;
    // Style elem as Flexbox
    Object.assign(elem.style, {
        display:"flex",
        flexWrap: "wrap",
        alignItems: "baseline",
        width: "calc(" + outerWidth + "% + " + wordSpacingPixels * 2 + "px)",
        marginLeft: "calc(" + negativeMargin + "% - " + wordSpacingPixels + "px)",
        marginRight: "calc(" + negativeMargin + "% - " + wordSpacingPixels + "px)",
        //marginBottom: "-" + verticalSpacing
    });
    
    function getStringWidthHeight(text, fontSize, cssStyles) { // TODO just get text styles from DOM
        var width, height;
        // This is tricky. There are a few methods we can use, in fallback order:
        // 1. Use canvas context.measureText(). This is not supported by any browsers but will be eventually.
        // https://html.spec.whatwg.org/dev/canvas.html#drawing-text-to-the-bitmap
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext("2d");
        switch (cssStyles['text-transform']){
            case "uppercase":
                text = text.toUpperCase();
                break;
            case "lowercase":
                text = text.toLowerCase();
                break;
            case "capitalize":
                text = text.replace(/(?:^|\s)\S/g, function(a){return a.toUpperCase(); });
                break;
        }
        if (DEBUG){
            document.body.appendChild(canvas);
        }
        if (typeof(ctx) != 'undefined'){ // we have canvas
            ctx.font = cssStyles['font-style'] + " " + cssStyles['font-weight'] + " " + fontSize + " " + cssStyles['font-family'];
            debug("font: " + ctx.font);
            var metrics = ctx.measureText(text);
            var height = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
            var descent = metrics.actualBoundingBoxDescent;
            var width = metrics.width;
            if (typeof(height) != 'undefined' && !isNaN(height)){ 
                // we have measureText()!!
                debug("using measureText() for: ");
                debug(text);
                debug("width: " + width + " height: " + height+ " descent: " + descent);
                return [width, height, descent];
            }
            // 2. No measureText() so manually scan pixels to find the bounding box
            // Scanline code copied from https://github.com/Pomax/fontmetrics.js
            var padding = 100;
            canvas.width = width + padding;
            fontSizePx = fontSize.replace("px","");
            canvas.height = 3 * fontSizePx;
            canvas.style.opacity = 1;
            // apparently we have to set this again??
            ctx.font = cssStyles['font-style'] + " " + cssStyles['font-weight'] + " " + fontSize + " " + cssStyles['font-family'];
            debug("font: " + ctx.font);

            var w = canvas.width,
                h = canvas.height,
                baseline = h/2;

            // Set all canvas pixeldata values to 255, with all the content
            // data being 0. This lets us scan for data[i] != 255.
            ctx.fillStyle = "white";
            ctx.fillRect(-1, -1, w+2, h+2);
            ctx.fillStyle = "black";
            ctx.fillText(text, padding/2, baseline);
            var pixelData = ctx.getImageData(0, 0, w, h).data;

            // canvas pixel data is w*4 by h*4, because R, G, B and A are separate,
            // consecutive values in the array, rather than stored as 32 bit ints.
            var i = 0,
                w4 = w * 4,
                len = pixelData.length;

            // Finding the ascent uses a normal, forward scanline
            while (++i < len && pixelData[i] === 255) {}
            var asc = (i/w4)|0;

            // Finding the descent uses a reverse scanline
            i = len - 1;
            while (--i > 0 && pixelData[i] === 255) {}
            var desc = (i/w4)|0;

            if (true){
                // find the min-x coordinate
                for(i = 0; i<len && pixelData[i] === 255; ) {
                  i += w4;
                  if(i>=len) { i = (i-len) + 4; }}
                var minx = ((i%w4)/4) | 0;

                // find the max-x coordinate
                var step = 1;
                for(i = len-3; i>=0 && pixelData[i] === 255; ) {
                  i -= w4;
                  if(i<0) { i = (len - 3) - (step++)*4; }}
                var maxx = ((i%w4)/4) + 1 | 0;
            }

            // set font metrics
            var ascent = (baseline - asc);
            var descent = 1+(desc - baseline);
            var height = 1+(desc - asc);
            var width = maxx - minx;
            var xOffset = minx - padding/2;
            
            debug("scanned pixel by pixel: " + text);
            debug("width: " + width + " height: " + height+ " descent: " + descent);
            debug("xOffset: " + (minx - padding/2));
            debug("-----------------------------------------");
            
            if (DEBUG){ // show bounds
                ctx.strokeStyle = "red";
                ctx.beginPath();
                ctx.moveTo(minx,baseline+descent);
                ctx.lineTo(minx+width,baseline+descent);
                ctx.lineTo(minx+width,baseline-ascent);
                ctx.lineTo(minx,baseline-ascent);
                ctx.lineTo(minx,baseline+descent);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(padding/2,0);
                ctx.lineTo(padding/2,3 * fontSizePx);
                ctx.stroke();
                }
            return [width, height, descent, xOffset];
        
        }
        // 3. If canvas isn't supported at all, use element.scrollWidth and scrollHeight.
        // The width is accurate but the height is off.
        var e = document.createElement('div');
        e.innerHTML = text;
        // Hide the elem and make it take up zero layout space
        Object.assign(e.style, {
            visibility:"hidden",
            display:"inline-block",
            position:"fixed",
            top:"0px",
            left:"0px",
            overflow:"visible",
            whiteSpace:"nowrap",
            padding:0,
            margin: 0,
            fontSize: minFontSize,
            fontFamily: fontFamily
        });
        document.body.appendChild(e);
        var width = e.scrollWidth;
        // Take a guess at lineheight. This really sucks.
        var height = e.scrollHeight / 1.3;
        // e.style.width = "1ex";
        //var exHeight = e.scrollWidth;
        var descent = 0;
        document.body.removeChild(e);
        debug("using scrollWidth/Height for: " + text);
        debug("width: " + width + " height: " + height+ " descent: " + descent);
        return [width, height, descent, xoffset];    
    } 

    // shortcut function for getting computed CSS values
    var getCSSValue = function(element, property) {
        return document.defaultView.getComputedStyle(element,null).getPropertyValue(property);
      };
}
