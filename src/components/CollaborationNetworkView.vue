<template>
  <div id="collaboration-network-view">
    <div id="artist-card" 
      style="position:absolute;bottom:0px;padding-bottom:1.25rem;width:fit-content;height:fit-content;display: none; z-index: 5;">
      <b-card style="width: 30rem;background-color:#f8f8f8;" class="mb-2">
        <b-card-title id="artist-title" style="text-transform: capitalize;">
          Card Title
        </b-card-title>
        <b-card-text id="artist-body">
          <b>Genres</b>
          <ul>
            <li v-for="item in genres" v-bind:key="item.genre">
              <a style="cursor:pointer;" :class="item" v-on:click="highlightGenres(item)">{{ item.genre }}</a>
            </li>
          </ul>
          <b-button v-on:click="highlightGenres(null)">Reset</b-button>
        </b-card-text>
      </b-card>
    </div>
    <div id="spinner2" style="position: absolute; width:fit-content;height:fit-content;z-index:6; display:none;">
      <b-card style="width: 15em;" class="mb-2">
        <img src="/loading2.gif" style="width:12.5em;"/>
      </b-card>
    </div>
    <svg id="collaboration-network-demo" style="position:absolute;"></svg>
  </div>
</template>

<script>
import * as d3 from "d3";
import axios from "axios";

export default {
  name: "CollaborationNetworkView",
  data() {
    return {
      graphData: {
        nodes: undefined,
        edges: undefined,
      },
      rendered: false,
      maxCount: -1,
      genres: [],
      currId: null,
    };
  },
  mounted: async function () {},
  methods: {
    tabLoaded: async function () {
      if (this.rendered) {
        return;
      }
      d3.select("#artist-card").style("display", "none");
      d3.select("#spinner2").style("display", "inline");
      console.log("setting");
      this.currId = "60fb73f6a8b65b7b2d9153df";
      await this.loadData("60fb73f6a8b65b7b2d9153df");
      console.log("unsetting");
      d3.select("#spinner2").style("display", "none");
      d3.select("#artist-card").style("display", "inline");
      this.drawNodeLinkDiagram("60fb73f6a8b65b7b2d9153df");
      this.rendered = true;
    },

    reload: async function(id) {
      d3.select("#collaboration-network-demo").html("");
      d3.select("#artist-card").style("display", "none");
      d3.select("#spinner2").style("display", "inline");
      this.currId = id;
      await this.loadData(id);
      d3.select("#spinner2").style("display", "none");
      d3.select("#artist-card").style("display", "inline");
      this.drawNodeLinkDiagram(id);
    },

    highlightGenres: async function(item) {
      var vueinstance = this;
      const scale = d3.scaleLinear().range(["#66ccff", "#3366ff"]).domain([0, Math.sqrt(vueinstance.maxCount)]);
      const svg = d3.select("#collaboration-network-demo");
      svg
        .selectAll("circle")
        .data(this.graphData.nodes)
        .join("circle")
        .attr("fill", function (d) {
          if (item != null && d.genres.includes(item.genre)) {console.log('a'); return "#00cc00";}
          console.log('b');
          return d.id==vueinstance.currId ? "#2d2d2d" : scale(Math.sqrt(d.count));
        });
    },

    loadData: async function (id) {
      // Hard-coded artist for now: Eminem
      const apiResult = await this.getCollaborationNetworkByArtist(id, 2);
      const edges = apiResult.relationships;
      const nodes = apiResult.artists;
      for (let i = 0; i < nodes.length; ++i) {
        nodes[i].id = nodes[i]._id;
        if (nodes[i].id == id) {
          // eslint-disable-next-line no-unused-labels
          this.genres = nodes[i].genres.map((k) => {return {genre: k};});
          d3.select("#artist-title").text(nodes[i].name);
        }
      }
      var connections = {};
      for (let i = 0; i < edges.length; ++i) {
        edges[i].source = edges[i].artist_1;
        edges[i].target = edges[i].artist_2;
        if (edges[i].artist_1 == id) {
          connections.[edges[i].artist_2] = edges[i].count;
        }
        if (edges[i].artist_2 == id) {
          connections.[edges[i].artist_1] = edges[i].count;
        }
      }
      for (let i = 0; i < nodes.length; ++i) {
        nodes[i].count = connections[nodes[i].id];
        if (nodes[i].count == undefined) nodes[i].count = 0;
        this.maxCount = Math.max(this.maxCount, nodes[i].count);
      }
      this.graphData.nodes = nodes;
      this.graphData.edges = edges;
    },

    getCollaborationNetworkByArtist: function (pivotId, depth, fetchAllEdges) {
      const paramsArray = [];
      if (!pivotId) {
        throw new Error(
          "Pivot artist ID must be specified for `getCollaborationNetworkByArtist`"
        );
      }
      paramsArray.push(["pivot", pivotId]);

      if (fetchAllEdges) {
        paramsArray.push(["fetch_all_edges", "true"]);
      }
      if (depth) {
        paramsArray.push(["depth", depth]);
      }
      const params = new URLSearchParams(paramsArray);
      return axios
        .get(`/api/aritstcollaboration`, { params })
        .then((res) => res.data);
    },

    drawNodeLinkDiagram: function (id) {
      const vueinstance = this;
      const scale = d3.scaleLinear().range(["#66ccff", "#3366ff"]).domain([0, Math.sqrt(vueinstance.maxCount)]);
      const nodes = this.graphData.nodes;
      const edges = this.graphData.edges;
      const svg = d3.select("#collaboration-network-demo");
      const bbox = document
        .getElementById("collaboration-network-demo")
        .getBoundingClientRect();

      const width = bbox.width,
        height = bbox.height;

      const simulation = d3
        .forceSimulation(nodes)
        .force(
          "link",
          d3.forceLink(edges).id((d) => d.id)
        )
        .force("charge", d3.forceManyBody())
        .force("center", d3.forceCenter(width / 2, height / 2));

      const drag = (simulation) => {
        function dragstarted(event) {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          if (event.subject) {
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
          }
        }

        function dragged(event) {
          event.subject.fx = event.x;
          event.subject.fy = event.y;
        }

        function dragended(event) {
          if (!event.active) simulation.alphaTarget(0);
          if (event.subject) {
            event.subject.fx = null;
            event.subject.fy = null;
          }
        }

        return d3
          .drag()
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended);
      };

      const link = svg
        .append("g")
        .attr("stroke", "#999")
        .attr("stroke-opacity", 0.6)
        .selectAll("line")
        .data(edges)
        .join("line")
        .attr("stroke-width", (d) => Math.sqrt(d.count));

      const node = svg
        .append("g")
        .attr("stroke", "#fff")
        .selectAll("circle")
        .data(nodes)
        .join("circle")
        .attr("r", 7)
        .attr("fill", function (d) {return d.id==id ? "#2d2d2d" : scale(Math.sqrt(d.count));})
        .attr("stroke-width", function (d) {return d.id==id ? 3.0 : 1.5})
        .call(drag(simulation))
        .on("click", function (d) {
          if (d.id != id) {
            vueinstance.reload(d.id);
          }
        });

      node.append("title").text((d) => `${d.name}\n${d.genres.join(", ")}`);
      link.append("title").text((d) => `${d.count} collaborations`);

      window.node = node;
      window.link = link;
      simulation.on("tick", () => {
        link
          .attr("x1", (d) => d.source.x)
          .attr("y1", (d) => d.source.y)
          .attr("x2", (d) => d.target.x)
          .attr("y2", (d) => d.target.y);

        node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
      });
    },
  },
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style lang="scss" scoped>
#collaboration-network-demo {
  min-width: 100%;
  min-height: 100%;
}
</style>
