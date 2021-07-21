A vanilla.js double recycler baseline that should be a good starting point for other uses.

The standard approach for rendering a heatmap in javascript is to use plotly.js. However, I had a need for a 1000 x 1000 heatmap, which plotly.js choked on. Also, plotly renders it's heatmaps by generating an image, which sometimes limits custom behavior.
