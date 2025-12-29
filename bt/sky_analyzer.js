function analyzeSkyFromImgData(imageData)
{
    let skyPixels = 0;
    const totalPixels = imageData.length / 4;

    for (let i = 0; i < imageData.length; i += 4) {
        const r = imageData[i];
        const g = imageData[i+1];
        const b = imageData[i+2];
        const luminance = 0.299*r + 0.587*g + 0.114*b;

        // Accept bright pixels or lightly saturated (white/gray clouds)
        const maxColor = Math.max(r,g,b);
        const minColor = Math.min(r,g,b);
        const saturation = (maxColor - minColor)/255;

        if (luminance > 150 && saturation < 0.7) 
            skyPixels++;
        else if (b > r && b > g) 
            skyPixels++;
    }

    const skyRatio = skyPixels / totalPixels;
    const MIN_SKY_RATIO = 0.55;
    let isSkyPhoto = skyRatio > MIN_SKY_RATIO;
    return {
        isSkyPhoto : isSkyPhoto,
        skyRatio: skyRatio
    };
}

function skyAnalyzer() 
{
    self.onmessage = function(imageData) {
        const skyAnalysisResult = analyzeSkyFromImgData(imageData)
        self.postMessage(skyAnalysisResult);
    }
}

async function analyzeSkyFromImg(img)
{
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img,0,0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const code = '(' + skyAnalyzer.toString() + ').call(self);';
  const blob = new Blob([code], { type: 'application/javascript' });
  const skyAnalyzerWorkerUrl = URL.createObjectURL(blob);

  const skyAnalyzerWorker = new Worker(skyAnalyzerWorkerUrl);

  skyAnalyzerWorker.onmessage = function(skyAnalysisResult) {
      console.log("Result from sky analysis worker:", skyAnalysisResult);
      resolve(skyAnalysisResult);
  };
  skyAnalyzerWorker.postMessage(imageData.data); // Send data to the worker
};

export async function analyzeSkyFromURL(imageURL) {
  return new Promise(resolve => {
    console.log("Analyzing sky coverage…");
    const img = new Image();
    img.onload = () => {
        analyzeSkyFromImg(img)
        .then(resolve);
    };
    img.src = imageURL;
  });
}

