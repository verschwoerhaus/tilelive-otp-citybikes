"use strict"
const geojsonVt = require('geojson-vt');
const vtPbf = require('vt-pbf');
const request = require('requestretry');
const zlib = require('zlib');
const clone = require("clone");

const query = `
  query bikerentals {
    bikeRentalStations {
      stationId
      name
      networks
      lon
      lat
    }
  }`

const getTileIndex = (uri, callback) => {
  request({
    url: uri,
    body: query,
    maxAttempts: 120,
    retryDelay: 30000,
    method: "POST",
    headers: {
      'Content-Type': 'application/graphql'
    }
  }, function (err, res, body){
    if (err){
      console.log(err)
      callback(err);
      return;
    }

    const geoJSON = {type: "FeatureCollection", features: JSON.parse(body).data.bikeRentalStations.map(station => ({
      type: "Feature",
      geometry: {type: "Point", coordinates: [station.lon, station.lat]},
      properties: {
        id: station.stationId,
        name: station.name,
        networks: station.networks.join()
      }
    }))}

    // console.log("city bikes loaded from:", this.uri.host + this.uri.path)
    callback(null, geojsonVt(geoJSON, {
      maxZoom: 20,
      buffer: 256
    }))  //TODO: this should be configurable
  });
}

class GeoJSONSource {
  constructor(uri, callback){
    this.uri = clone(uri)
    this.uri.protocol = "http:"
    callback(null, this)
  }

  getTile(z, x, y, callback){
   getTileIndex(this.uri, (err, tileIndex) => {
      let tile = tileIndex.getTile(z, x, y)

      if (tile === null) {
        tile = {features: []}
      }

      const data = Buffer.from(vtPbf.fromGeojsonVt({stations: tile}));

      zlib.gzip(data, function (err, buffer) {
        if (err){
          callback(err);
          return;
        }

        callback(null, buffer, {"content-encoding": "gzip"})
      })
    })
  }

  getInfo(callback){
    callback(null, {
      format: "pbf",
      vector_layers: [{
        description: "",
        id: "stations"
      }],
      maxzoom: 20,
      minzoom: 1,
      name: "OTP Citybikes"
    })
  }
}

module.exports = GeoJSONSource

module.exports.registerProtocols = (tilelive) => {
  tilelive.protocols['otpcitybikes:'] = GeoJSONSource
}
