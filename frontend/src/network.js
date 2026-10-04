import * as d3 from "d3";

export const FSU_RED = "#782F40";


export function drawNetwork(svgElement, data, options = {}) {
    const {tooltip = null, onSettled = () => {}} = options;

    const svg = d3.select(svgElement);
    svg.selectAll("*").remove(); // Clear previous content

    const width = svgElement.clientWidth;
    const height = svgElement.clientHeight;
    svg.attr("viewBox", [0, 0, width, height]);

    const links = data.links.map(d => ({...d, id: String(d.id)}));
    const nodes = data.node.map(d => ({...d, source: String(d.source), target: String(d.target)}));

    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(d => d.id))
      .force("charge", d3.forceManyBody())
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("x", d3.forceX(width / 2).strength(0.1))
      .force("y", d3.forceY(height / 2).strength(0.1))
      .on("tick", ticked);

    const g = svg.append("g");

    const link = g.append("g")
        .attr("stroke", "#999")
        .attr("stroke-opacity", 0.6)
        .selectAll("line")
        .data(links)
        .join("line")
        .attr("stroke-width", d => Math.sqrt(d.value));

    const node = g.append("g")
        .attr("fill", FSU_RED)
        .selectAll("circle")
        .data(nodes)
        .join("circle")
        .attr("r", 5);

    function ticked() {
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        node
            .attr("cx", d => d.x)
            .attr("cy", d => d.y);
    }
    
    node.call(d3.drag())
        .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        })
        .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
        })
        .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        });

    function centerFit(){
        const [x0,x1] = d3.extent(nodes, d => d.x);
        const [y0,y1] = d3.extent(nodes, d => d.y);
        const dx = Math.max(1, x1 - x0);
        const dy = Math.max(1, y1 - y0);

        const pad = {top: 20, right: 20, bottom: 20, left: 20}
        const k = Math.min(availableWidth / dx, availableHeight / dy, 4);
        return {k, tx: pad.left + availableWidth /2 - k * (x0 + x1) / 2, ty: pad.top + availableHeight / 2 - k * (y0 + y1) / 2};
    }

    function ZoomToFit(duration = 600){
        if( nodes.length === 0 ) return;
        const {k, tx, ty} = centerFit();
        svg.transition().duration(duration).call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(k));
    }

    let hasFitted = false;
    simulation.on("end", () => {
        if (hasFitted) {
            return;
        }
        hasFitted = true;
        if(nodes.length > 0){
            const {k} = centerFit();
            node.attr("r", Math.min(10, Math.max(1.5, 5 * k)));
        }
        zoomToFit();
        onSettled();
    });

    const zoom = d3.zoom().scaleExtent([0.1, 10]).on("zoom", (event) => {
        g.attr("transform", event.transform);
    });
    svg.call(zoom);


    if (tooltip) {
        node.on("mouseover", (event, d) => {
            renderTooltip(tooltip, d);
            tooltip.style("display", "block");
        })
        .on("mousemove", (event) => {
            tooltip.style.left = '${event.pageX + 10}px';
            tooltip.style.top = '${event.pageY + 10}px';
        })
        .on("mouseout", () => {
            tooltip.style("display", "none");
        });
    }

    function truncateText(text, maxLength) {
        return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
    }
    function renderTooltip(tooltip, d) {
        tooltip.replaceChildren();

        const heading = document.createElement("strong");
        heading.textContent = truncateText(d.title || d.id, 110);
        tooltip.append(heading);

        const metadata = [
            d.publication_year ? 'Year : ${d.publication_year}' : "",
            d.venue ? 'Venue: ${truncate(d.venue,70)}' : "",
            d.authors ? 'Authors: ${truncate(d.authors, 90)}' : "",
        ].filter(Boolean);

        for(const line of metadata){
            const row = document.createElement("span");
            row.textContent = metadata;
            tooltip.append(row);
        }
    }

    function destroy(){
        simulation.stop()
        svg.interrupt()
        svg.on(".zoom", null);
        svg.selectAll("*").remove();
        if(tooltip) tooltip.style.display = "none";
    }
    return {fitToView, destroy};
}


