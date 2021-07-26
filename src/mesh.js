const fs = require('fs');
const wavefrontObjParser = require('wavefront-obj-parser');
const expandVertexData = require('expand-vertex-data');

const { Triangle } = require('./triangle.js');
const { Vector3 } = require("./vector.js");

// Map .obj vertex info line names to our returned property names
var vertexInfoNameMap = {v: 'vertexPositions', vt: 'vertexUVs', vn: 'vertexNormals'};

class Mesh {

    constructor(obj_path) {
        const mtl_path = obj_path.substring(0, obj_path.length - 3) + "mtl";

        // Parse .obj
        const wavefrontString = fs.readFileSync(obj_path).toString('utf8');
        const parsedJSON = this._parseWavefrontObj(wavefrontString);
        
        // Parse .mtl
        const materialString = fs.readFileSync(mtl_path).toString('utf8');
        this._materials = this._parseMaterial(materialString);

        const expanded = expandVertexData(parsedJSON, {facesToTriangles: true});
        this._data = {
            position: expanded.positions,
            normal: expanded.normals,
            texcoord: expanded.uvs,
            indices: expanded.positionIndices,
            materials: parsedJSON.vertexMaterial
        };

        this._materialIndices = {};
        for (let i = 0; i < parsedJSON.vertexMaterial.length; ++i) {
            const material = parsedJSON.vertexMaterial[i];
            const index = expanded.positionIndices[i];
            if (this._materialIndices[material]) {
                this._materialIndices[material].push(index);
            } else {
                this._materialIndices[material] = [index];
            }
        }

        this._getTriangles();
        console.log(this.triangles);
    }

    _parseMaterial(materialString) {
        var materialJSON = {};

        const lines = materialString.split('\n');

        let currentMaterialName = null;
        let currentMaterialData = {};

        lines.forEach((line) => {
            const lineTokens = line.trim().split(/\s+/);
            switch (lineTokens[0]) {
                case "newmtl":
                    if (currentMaterialName) {
                        materialJSON[currentMaterialName] = currentMaterialData;
                    }
                    currentMaterialName = lineTokens[1];
                    currentMaterialData = {};
                    break;
                case "Kd":
                    currentMaterialData.diffuseColour = lineTokens.slice(1).map(x => parseFloat(x));
                    break;
                case "map_Kd":
                    const texturePath = lineTokens[1];
                    if (!fs.lstatSync(texturePath).isFile()) {
                        throw Error(`Cannot load texture: ${texturePath}`);
                    }
                    currentMaterialData.diffuseTexturePath = texturePath;
                    break;
            }
        });
        materialJSON[currentMaterialName] = currentMaterialData;

        return materialJSON;
    }

    /*
        DISCLAIMER: This is a modified version of wavefront-obj-parser
        to include .mtl data (https://www.npmjs.com/package/wavefront-obj-parser)
    */
    _parseWavefrontObj(wavefrontString) {

        var parsedJSON = {
            vertexNormals: [],
            vertexUVs: [],
            vertexPositions: [],
            vertexNormalIndices: [],
            vertexUVIndices: [],
            vertexPositionIndices: [],
            vertexMaterial: []
        };

        var linesInWavefrontObj = wavefrontString.split('\n');
        var currentMaterial = null;

        // Loop through and parse every line in our .obj file
        for (let i = 0; i < linesInWavefrontObj.length; i++) {
            const currentLine = linesInWavefrontObj[i];
            // Tokenize our current line
            const currentLineTokens = currentLine.trim().split(/\s+/);
            // vertex position, vertex texture, or vertex normal
            const vertexInfoType = vertexInfoNameMap[currentLineTokens[0]];

            if (vertexInfoType) {
                for (let k = 1; k < currentLineTokens.length; k++) {
                    parsedJSON[vertexInfoType].push(parseFloat(currentLineTokens[k]));
                }
                continue;
            }

            if (currentLineTokens[0] === 'usemtl') {
                currentMaterial = currentLineTokens[1];
            }

            if (currentLineTokens[0] === 'f') {
                // Get our 4 sets of vertex, uv, and normal indices for this face
                for (let k = 1; k < 5; k++) {
                    // If there is no fourth face entry then this is specifying a triangle
                    // in this case we push `-1`
                    // Consumers of this module should check for `-1` before expanding face data
                    if (k === 4 && !currentLineTokens[4]) {
                        parsedJSON.vertexPositionIndices.push(-1);
                        parsedJSON.vertexUVIndices.push(-1);
                        parsedJSON.vertexNormalIndices.push(-1);
                        //parsedJSON.vertexMaterial.push(currentMaterial);
                    } else {
                        var indices = currentLineTokens[k].split('/');
                        parsedJSON.vertexPositionIndices.push(parseInt(indices[0], 10) - 1); // We zero index
                        parsedJSON.vertexUVIndices.push(parseInt(indices[1], 10) - 1); // our face indices
                        parsedJSON.vertexNormalIndices.push(parseInt(indices[2], 10) - 1); // by subtracting 1
                        parsedJSON.vertexMaterial.push(currentMaterial);
                    }
                }
            }
        }

        return parsedJSON;
    }


    _getTriangles() {
        this.materialTriangles = {};

        for (const material in this._materialIndices) {
            let triangles = [];
            const indices = this._materialIndices[material];

            for (let i = 0; i < indices.length; i += 3) {
                const i0 = indices[i];
                const i1 = indices[i + 1];
                const i2 = indices[i + 2];

                const v0 = this._data.position.slice(3 * i0, 3 * i0 + 3);
                const v1 = this._data.position.slice(3 * i1, 3 * i1 + 3);
                const v2 = this._data.position.slice(3 * i2, 3 * i2 + 3);

                const v0_ = new Vector3(v0[0], v0[1], v0[2]);
                const v1_ = new Vector3(v1[0], v1[1], v1[2]);
                const v2_ = new Vector3(v2[0], v2[1], v2[2]);

                triangles.push(new Triangle(v0_, v1_, v2_));
            }

            this.materialTriangles[material] = triangles;
        }
    }

}

module.exports.Mesh = Mesh;