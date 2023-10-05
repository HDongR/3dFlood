
/** 4326 to 3857 */
export function WGS84ToMercator(coord, height){
	let proj1 = proj4("EPSG:4326", "EPSG:3857", {
		x: coord[0],
		y: coord[1],
	});
	return proj1;
}

/** 3857 to 4326 */
export function MercatorToWGS84(coord, height){
	let proj1 = proj4("EPSG:3857", "EPSG:4326", {
		x: coord[0],
		y: coord[1],
	});
	return proj1;
}

/** byteArray to string */
export function intArrayToString(array) {
    var ret = [];
    for (var i = 0; i < array.length; i++) {
      var chr = array[i];
      if (chr > 0xFF) {
        if (ASSERTIONS) {
          assert(false, 'Character code ' + chr + ' (' + String.fromCharCode(chr) + ')  at offset ' + i + ' not in 0x00-0xFF.');
        }
        chr &= 0xFF;
      }
      ret.push(String.fromCharCode(chr));
    }
    return ret.join('');
}