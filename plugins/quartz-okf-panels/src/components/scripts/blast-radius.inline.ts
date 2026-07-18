// @ts-nocheck
// Self-contained: derives the current slug from the URL and assumes the site is
// served at the domain root (no basePath), which is the deployment shape here.
(function () {
  function simplifySlug(value) {
    return String(value || "")
      .replace(/\/index$/, "")
      .replace(/^index$/, "")
      .replace(/\/$/, "");
  }
  function getBasePath() {
    return "";
  }
  function getFullSlugFromUrl() {
    return location.pathname
      .replace(/^\//, "")
      .replace(/\.html$/, "")
      .replace(/\/$/, "");
  }

  var TYPE_COLOR = {
    application: { light: "#a3459c", dark: "#c060b8" },
    service: { light: "#008300", dark: "#008300" },
    component: { light: "#76b041", dark: "#649f34" },
    cluster: { light: "#2a78d6", dark: "#3987e5" },
    node: { light: "#a3459c", dark: "#c060b8" },
    router: { light: "#0891b2", dark: "#17a2bd" },
    network: { light: "#1baf7a", dark: "#199e70" },
    datastore: { light: "#eb6834", dark: "#d95926" },
    technology: { light: "#4a3aa7", dark: "#9085e9" },
    runbook: { light: "#e87ba4", dark: "#d55181" },
    decision: { light: "#eda100", dark: "#c98500" },
    incident: { light: "#e34948", dark: "#e66767" },
    concept: { light: "#6b7fd7", dark: "#6f80e3" },
    report: { light: "#6b7fd7", dark: "#6f80e3" },
  };

  // Labels whose mirror is derived by the toolkit; their inbound declarations
  // already surface as derived outbound edges on this node, so the inbound
  // section must skip them to avoid listing the same relation twice.
  var INVERTIBLE = {
    "Part of": true,
    Contains: true,
    "Runs on": true,
    Hosts: true,
    Uses: true,
    "Consumed by": true,
    "Peers with": true,
  };
  var KNOWLEDGE = { About: true, Affects: true };

  var graphPromise = null;
  function loadGraph() {
    if (graphPromise) return graphPromise;
    var url = (getBasePath() || "") + "/static/okf-graph.json";
    graphPromise = fetch(url)
      .then(function (response) {
        return response.ok ? response.json() : null;
      })
      .catch(function () {
        return null;
      });
    return graphPromise;
  }

  function mode() {
    return document.documentElement.getAttribute("saved-theme") === "dark" ? "dark" : "light";
  }

  function esc(value) {
    var element = document.createElement("div");
    element.textContent = value == null ? "" : value;
    return element.innerHTML;
  }

  function group(edges, slug, direction) {
    var out = {};
    for (var i = 0; i < edges.length; i++) {
      var edge = edges[i];
      if (!edge.target) continue;
      var source = simplifySlug(edge.source);
      var target = simplifySlug(edge.target);
      var self = direction === "out" ? source : target;
      var other = direction === "out" ? target : source;
      if (self === slug) {
        (out[edge.label] = out[edge.label] || []).push(other);
      }
    }
    return out;
  }

  function section(title, groups, nodeMap, m) {
    var labels = Object.keys(groups).sort();
    if (!labels.length) return "";
    var html = '<div class="okf-blast-section"><h4>' + title + "</h4>";
    for (var li = 0; li < labels.length; li++) {
      var label = labels[li];
      var items = groups[label];
      var chips = "";
      for (var ii = 0; ii < items.length; ii++) {
        var node = nodeMap[items[ii]];
        if (!node) continue;
        var color = TYPE_COLOR[node.type] ? TYPE_COLOR[node.type][m] : "var(--gray)";
        chips +=
          '<a class="okf-blast-node" href="' +
          (getBasePath() || "") +
          "/" +
          items[ii] +
          '"><span class="okf-blast-dot" style="background:' +
          color +
          '"></span>' +
          esc(node.title) +
          "</a>";
      }
      if (chips) {
        html +=
          '<div class="okf-blast-rel"><span class="okf-blast-label">' +
          esc(label) +
          '</span><span class="okf-blast-targets">' +
          chips +
          "</span></div>";
      }
    }
    return html + "</div>";
  }

  function render() {
    var container = document.querySelector(".okf-blast");
    if (!container) return;
    var slug = simplifySlug(getFullSlugFromUrl());
    loadGraph().then(function (graphData) {
      if (!graphData || !graphData.edges) {
        container.style.display = "none";
        return;
      }
      var nodeMap = {};
      for (var i = 0; i < graphData.nodes.length; i++) {
        nodeMap[simplifySlug(graphData.nodes[i].slug)] = graphData.nodes[i];
      }
      var m = mode();
      var inGroups = group(graphData.edges, slug, "in");
      var knowledgeGroups = {};
      for (var label in inGroups) {
        if (KNOWLEDGE[label]) {
          knowledgeGroups[label] = inGroups[label];
          delete inGroups[label];
        } else if (INVERTIBLE[label]) {
          delete inGroups[label];
        }
      }
      var out = section("Depends on", group(graphData.edges, slug, "out"), nodeMap, m);
      var inc = section("Required by", inGroups, nodeMap, m);
      var knowledge = section("Related knowledge", knowledgeGroups, nodeMap, m);
      if (!out && !inc && !knowledge) {
        container.style.display = "none";
        return;
      }
      container.style.display = "";
      container.innerHTML = "<h3>Blast radius</h3>" + out + inc + knowledge;
    });
  }

  document.addEventListener("nav", render);
  document.addEventListener("render", render);
})();
