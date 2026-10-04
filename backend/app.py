from flask import Flask, jsonify
from flask_cors import CORS
import pandas as pd
import networkx as nx
from pathlib import Path
from functools import lru_cache

DATA_DIR = Path(__file__).parent / "data"
CITATIONS_CSV = DATA_DIR / "paper_citation_links_within_fsu.csv"
WORKS_CSV = DATA_DIR / "fsu_works_2021_2026.csv"

app = Flask(__name__)
CORS(app)

def only_id(openalex_url: str) -> str:
    return openalex_url.rstrip("/").split("/")[-1]

def load_citations() -> pd.DataFrame:
    fsu_citations = pd.read_csv(CITATIONS_CSV, dtype=str).dropna()

    fsu_citations["citing_paper"] = fsu_citations["citing_paper"].astype(str)
    fsu_citations["cited_paper"] = fsu_citations["cited_paper"].astype(str)

    return (fsu_citations.groupby(["citing_paper", "cited_paper"]).size().reset_index(name="value"))

def load_metadata() -> pd.DataFrame:
    if not WORKS_CSV.exists():
        return {}
    works_metadata = pd.read_csv(WORKS_CSV, usecols=["openalex_id", "title", "publication_year", "venue", "authors"])
    metadata = {}
    for row in works_metadata.itertuples(index=False):
        metadata[str(row.openalex_id)] = {
            "title": "" if pd.isna(row.title) else row.title,
            "publication_year": None if pd.isna(row.publication_year) else int(row.publication_year),
            "venue": "" if pd.isna(row.venue) else str(row.venue),
            "authors": "" if pd.isna(row.authors) else str(row.authors)
        }
    return metadata

@lru_cache(maxsize=1)
def build_network():
    citations_df = load_citations()
    metadata = load_metadata()

    G = nx.DiGraph()
    G.add_edges_from(zip(citations_df["citing_paper"], citations_df["cited_paper"]))

    group_of = {}
    for gid, component in enumerate(nx.weakly_connected_components(G)):
        for node in component:
            group_of[node] = gid
    nodes = []
    for node in G.nodes:
        info = metadata.get(node, {})
        nodes.append({
            "id": str(node),
            "only_id": only_id(node),
            "group": group_of[node],
            "title": info.get("title", ""),
            "publication_year": info.get("publication_year"),
            "venue": info.get("venue", ""),
            "authors": info.get("authors", "")
        })

    links = [
        {"source": str(row.citing_paper), "target": str(row.cited_paper), "value": int(row.value)}
        for row in citations_df.itertuples(index=False)
    ]
    return {"nodes": nodes, "links": links}

@app.get("/api/network")
def get_network():
    return jsonify(build_network())

@app.get("/api/Analytics")
def get_analytics():
    network_data = build_network()
    G = nx.DiGraph()
    G.add_edges_from((link["source"], link["target"]) for link in network_data["links"])
    by_id = {node["id"]: node for node in network_data["nodes"]}
    top_cited = sorted(G.in_degree(), key=lambda x: x[1], reverse=True)[:10]
    return jsonify({
        "Number of Papers": G.number_of_nodes(),
        "Number of Citation links": G.number_of_edges(),
        "Components": nx.number_weakly_connected_components(G),
        "Top 10 Cited Papers": [{"id": by_id[node_id]["only_id"], "title" : by_id[node_id]["title"], "citations": citations} for node_id, citations in top_cited]
    })

if __name__ == '__main__':
    app.run(port=5001, debug=True)

