let rawData = [];

d3.csv("../../data/final_data.csv").then(data => {
  data.forEach(d => {
    d.Date = new Date(d.Date);
    d.Year = d.Date.getFullYear();
    d.Month = d3.timeFormat("%b")(d.Date);
    d["Price per Unit"] = +d["Price per Unit"];
    d["Total Amount"] = +d["Total Amount"];
    d["Transaction Count"] = 1;
  });

  rawData = data;

  initFilters(data);
  updateBarChart();
  updateScatterPlot();
});

function initFilters(data) {
  const years = Array.from(new Set(data.map(d => d.Year))).sort();
  const categories = Array.from(new Set(data.map(d => d["Product Category"]))).sort();

  const yearSelect = d3.select("#yearSelect");
  yearSelect.selectAll("option")
    .data(["All", ...years])
    .enter()
    .append("option")
    .attr("value", d => d)
    .text(d => d === "All" ? "Tất cả các năm" : d)



  const categorySelect = d3.select("#categorySelect");
  categories.forEach(c => {
    categorySelect.append("option")
      .attr("value", c)
      .text(c);
  });

  yearSelect.on("change", updateBarChart);
  categorySelect.on("change", updateScatterPlot);
}

function updateBarChart() {
  const selectedValue = d3.select("#yearSelect").property("value");
  const data = selectedValue === "All" ? rawData : rawData.filter(d => d.Year === +selectedValue);

  const grouped = d3.rollup(data,
    v => v.length,
    d => d.Month,
    d => d.Gender,
    d => d["Product Category"]
  );

  const flatData = [];
  for (let [month, genderMap] of grouped.entries()) {
    for (let [gender, catMap] of genderMap.entries()) {
      for (let [category, count] of catMap.entries()) {
        flatData.push({ Month: month, Gender: gender, Category: category, Count: count });
      }
    }
  }

  d3.select("#barChart").selectAll("*").remove();

  const svg = d3.select("#barChart"),
        margin = {top: 70, right: 20, bottom: 60, left: 50},
        width = +svg.attr("width") - margin.left - margin.right,
        height = +svg.attr("height") - margin.top - margin.bottom,
        g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", 
                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].filter(m =>
                    flatData.some(d => d.Month === m));
  const genders = [...new Set(flatData.map(d => d.Gender))];
  const categories = [...new Set(flatData.map(d => d.Category))];
  const color = d3.scaleOrdinal().domain(categories).range(d3.schemeSet2);

  const x0 = d3.scaleBand().domain(months).range([0, width]).padding(0.2);
  const x1 = d3.scaleBand().domain(genders).range([0, x0.bandwidth()]).padding(0.05);
  const y = d3.scaleLinear().domain([0, d3.max(flatData, d => d.Count)]).nice().range([height, 0]);

  g.selectAll("g")
    .data(months)
    .join("g")
      .attr("transform", d => `translate(${x0(d)},0)`)
    .selectAll("rect")
    .data(month => flatData.filter(d => d.Month === month))
    .join("rect")
      .attr("x", d => x1(d.Gender))
      .attr("y", d => y(d.Count))
      .attr("width", x1.bandwidth())
      .attr("height", d => height - y(d.Count))
      .attr("fill", d => color(d.Category))
      .on("mouseover", (event, d) => showTooltip(event, `${d.Gender}, ${d.Category}: ${d.Count}`))
      .on("mouseout", hideTooltip);

  g.append("g").call(d3.axisLeft(y));
  g.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x0));

  // Nhãn giới tính dưới mỗi nhóm tháng
  months.forEach(month => {
    genders.forEach(gender => {
      g.append("text")
        .attr("x", x0(month) + x1(gender) + x1.bandwidth() / 2)
        .attr("y", height + 25)
        .attr("text-anchor", "middle")
        .attr("font-size", "10px")
        .text(gender === "Male" ? "Nam" : "Nữ");
    });
  });

  createLegend(svg, categories, color, 20, 10);
}

function updateScatterPlot() {
  const selectedCategory = d3.select("#categorySelect").property("value");
  const data = selectedCategory === "All"
    ? rawData
    : rawData.filter(d => d["Product Category"] === selectedCategory);

  d3.select("#scatterPlot").selectAll("*").remove();

  const svg = d3.select("#scatterPlot"),
        margin = {top: 70, right: 20, bottom: 50, left: 60},
        width = +svg.attr("width") - margin.left - margin.right,
        height = +svg.attr("height") - margin.top - margin.bottom,
        g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear().domain(d3.extent(data, d => d["Price per Unit"])).nice().range([0, width]);
  const y = d3.scaleLinear().domain(d3.extent(data, d => d["Total Amount"])).nice().range([height, 0]);

  const categories = [...new Set(data.map(d => d["Product Category"]))];
  const color = d3.scaleOrdinal().domain(categories).range(d3.schemeSet2);

  g.selectAll("circle")
    .data(data)
    .join("circle")
      .attr("cx", d => x(d["Price per Unit"]))
      .attr("cy", d => y(d["Total Amount"]))
      .attr("r", 5)
      .attr("fill", d => color(d["Product Category"]))
      .attr("opacity", 0.7)
      .on("mouseover", (event, d) => showTooltip(event, `${d["Product Category"]}<br>Giá: ${d["Price per Unit"]}<br>Doanh thu: ${d["Total Amount"]}`))
      .on("mouseout", hideTooltip);

  g.append("g").call(d3.axisLeft(y));
  g.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x));

  createLegend(svg, categories, color, 20, 10);
}

const tooltip = d3.select("#tooltip");

function showTooltip(event, content) {
  tooltip.style("opacity", 1)
         .html(content)
         .style("left", (event.pageX + 10) + "px")
         .style("top", (event.pageY - 28) + "px");
}
function hideTooltip() {
  tooltip.style("opacity", 0);
}

function createLegend(svg, categories, color, x, y) {
  const legend = svg.append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${x},${y})`);

  const legendItems = legend.selectAll(".legend-item")
    .data(categories)
    .enter()
    .append("g")
    .attr("class", "legend-item")
    .attr("transform", (d, i) => `translate(${(i % 4) * 150}, ${Math.floor(i / 4) * 20})`);

  legendItems.append("rect")
    .attr("class", "legend-color")
    .attr("width", 12)
    .attr("height", 12)
    .attr("fill", d => color(d));

  legendItems.append("text")
    .attr("x", 18)
    .attr("y", 10)
    .text(d => d);
}



