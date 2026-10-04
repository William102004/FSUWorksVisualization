from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

def build_network():
    
    return {"nodes": [], "links": []}

@app.get("/api/network")
def get_network():
    return jsonify(build_network())

if __name__ == '__main__':
    app.run(port=5001, debug=True)
