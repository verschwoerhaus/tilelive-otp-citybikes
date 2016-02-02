"use strict"
const geojsonVt = require('geojson-vt');
const vtPbf = require('vt-pbf');
const request = require('requestretry');
const zlib = require('zlib');


class GeoJSONSource {
  constructor(uri, callback){
    uri.protocol = "http:"
    request({
      url: uri,
      maxAttempts: 20,
      retryDelay: 30000,
      headers: {
        'Accept': 'application/json'
      }
    }, function (err, res, body){
      if (err){
        console.log(err)
        callback(err);
        return;
      }

      const geoJSON = {type: "FeatureCollection", features: JSON.parse(body).stations.map(station => ({
        type: "Feature",
        geometry: {type: "Point", coordinates: [station.x, station.y]},
        properties: {
          id: station.id,
          name: station.name
        }
      }))}

      this.tileIndex = geojsonVt(geoJSON, {maxZoom: 20}); //TODO: this should be configurable
      callback(null, this)
    }.bind(this));
  };

  getTile(z, x, y, callback){
    let tile = this.tileIndex.getTile(z, x, y)

    if (tile === null){
      tile = {features: []}
    }

    zlib.gzip(vtPbf.fromGeojsonVt({ stations: tile}), function (err, buffer) {
      if (err){
        callback(err);
        return;
      }

      callback(null, buffer, {"content-encoding": "gzip"})
    })
  }

  getInfo(callback){
    callback(null, {
      format: "pbf",
      vector_layers: [{
        description: "",
        id: "stations"
      }]
    })
  }
}

module.exports = GeoJSONSource

module.exports.registerProtocols = (tilelive) => {
  tilelive.protocols['otpcitybikes:'] = GeoJSONSource
}
