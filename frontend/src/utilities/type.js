export function dataURLtoBlob(dataurl) {
    if (!dataurl) return null;
    var arr = dataurl.split(',');
    if (arr.length < 2) {
        // Fallback: assume it is a raw base64 string of a PNG
        arr = ['data:image/png;base64', dataurl];
    }
    var match = arr[0].match(/:(.*?);/);
    var mime = match ? match[1] : 'image/png';
    var bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], {type:mime});
}

export function blobToDataURL(blob, callback) {
    var a = new FileReader();
    a.onload = function(e) {callback(e.target.result);}
    a.readAsDataURL(blob);
}

