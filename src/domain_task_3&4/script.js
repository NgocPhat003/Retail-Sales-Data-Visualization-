const margin = { top: 40, right: 30, bottom: 100, left: 100 },
      width = 1000 - margin.left - margin.right,
      height = 600 - margin.top - margin.bottom;

const svg = d3.select("svg")
  .append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

const tooltip = d3.select(".d3-tooltip");
const genderSelect = d3.select("#genderSelect");
const yearSelect = d3.select("#yearSelect");

let fullData;
const parseMDY = d3.timeParse("%m/%d/%Y");

d3.csv("../../data/final_data.csv").then(data => {
  const parseMDY = d3.timeParse("%m/%d/%Y");

  data.forEach(d => {
    d["Total Amount"] = +d["Total Amount"];
    d.Age = +d.Age;
    d.AgeLabel = d.Age < 30 ? "Dưới 30 tuổi" : d.Age <= 50 ? "Từ 30 đến 50 tuổi" : "Trên 50 tuổi";
    d.Gender = d.Gender.toLowerCase();

    // Parse Date
    if (typeof d.Date === "string" && d.Date.includes("/")) {
      const parsed = parseMDY(d.Date.trim());
      d.Date = (parsed instanceof Date && !isNaN(parsed)) ? parsed : null;
    } else {
      d.Date = null;
    }

    // Gán tháng + năm nếu date hợp lệ
    if (d.Date) {
      d.Month = d3.timeFormat("%Y-%m")(d.Date);
      d.Year = d.Date.getFullYear();
    }
  });

  // Chỉ giữ dòng có Date hợp lệ
  fullData = data.filter(d => d.Date && d.Year >= 2020 && d.Year <= 2024);
  updateChart(genderSelect.property("value"));


  const uniqueYears = Array.from(new Set(fullData.map(d => d.Year))).sort();
  yearSelect.selectAll("option")
    .data(uniqueYears)
    .enter()
    .append("option")
    .attr("value", d => d)
    .text(d => d);

  const initialYear = uniqueYears[0];
  drawLineChartByMonth(fullData.filter(d => d.Year === initialYear), initialYear);
});

genderSelect.on("change", function () {
  updateChart(this.value);
});

yearSelect.on("change", function () {
  const year = +this.value;
  const filtered = fullData.filter(d => d.Year === year);
  drawLineChartByMonth(filtered, year);
});

function updateChart(genderFilter) {
  svg.selectAll("*").remove();

  const filtered = fullData.filter(d => d.Gender === genderFilter);
  const grouped = d3.rollup(
    filtered,
    v => d3.sum(v, d => d["Total Amount"]),
    d => d.AgeLabel,
    d => d["Product Category"]
  );

  const ageOrder = ["Dưới 30 tuổi", "Từ 30 đến 50 tuổi", "Trên 50 tuổi"];
  const categories = Array.from(new Set(filtered.map(d => d["Product Category"])));

  const x0 = d3.scaleBand().domain(ageOrder).range([0, width]).padding(0.2);
  const x1 = d3.scaleBand().domain(categories).range([0, x0.bandwidth()]).padding(0.05);
  const y = d3.scaleLinear()
              .domain([0, d3.max(Array.from(grouped.values()).flatMap(d => Array.from(d.values()))) || 0])
              .nice()
              .range([height, 0]);

  const color = d3.scaleOrdinal().domain(categories).range(d3.schemeTableau10);

  const group = svg.append("g")
    .selectAll("g")
    .data(ageOrder)
    .join("g")
    .attr("transform", d => `translate(${x0(d)},0)`);

  const bars = group.selectAll("rect")
    .data(d => categories.map(cat => ({
      ageLabel: d,
      category: cat,
      value: (grouped.get(d) && grouped.get(d).get(cat)) || 0
    })))
    .join("rect")
    .attr("x", d => x1(d.category))
    .attr("width", x1.bandwidth())
    .attr("fill", d => color(d.category))
    .attr("y", height)
    .attr("height", 0)
    .on("mouseover", function (event, d) {
      tooltip.style("visibility", "visible")
             .style("opacity", 1)
             .html(`<strong>${d.ageLabel}</strong><br>${d.category}: ${d.value.toLocaleString()}`);
      d3.select(this).attr("fill", d3.rgb(color(d.category)).darker(1));
    })
    .on("mousemove", function (event) {
      tooltip.style("top", (event.pageY - 40) + "px")
             .style("left", (event.pageX + 15) + "px");
    })
    .on("mouseout", function () {
      tooltip.style("visibility", "hidden").style("opacity", 0);
      d3.select(this).attr("fill", d => color(d.category));
    });

  bars.transition().duration(600).attr("y", d => y(d.value)).attr("height", d => height - y(d.value));

  svg.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x0))
    .selectAll("text")
    .attr("transform", "rotate(10)")
    .style("text-anchor", "start");

  svg.append("g").transition().duration(600).call(d3.axisLeft(y));

  svg.append("text")
    .attr("x", width / 2)
    .attr("y", height + 60)
    .attr("text-anchor", "middle")
    .style("font-size", "14px")
    .text("Nhóm Tuổi");

  svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -60)
    .attr("x", -height / 2)
    .attr("text-anchor", "middle")
    .style("font-size", "14px")
    .text("Doanh thu");

  const legend = svg.append("g").attr("transform", `translate(${width - 150}, 0)`);
  categories.forEach((cat, i) => {
    legend.append("rect").attr("x", 0).attr("y", i * 20).attr("width", 12).attr("height", 12).attr("fill", color(cat));
    legend.append("text").attr("x", 18).attr("y", i * 20 + 10).text(cat).style("font-size", "12px").attr("alignment-baseline", "middle");
  });

  // Nhận xét
  let flatData = [];
  for (const [ageGroup, catMap] of grouped.entries()) {
    for (const [category, value] of catMap.entries()) {
      flatData.push({ ageGroup, category, value });
    }
  }
  const totalByAgeGroup = d3.rollup(flatData, v => d3.sum(v, d => d.value), d => d.ageGroup);
  const topAgeGroup = Array.from(totalByAgeGroup.entries()).sort((a, b) => b[1] - a[1])[0];
  const maxVal = d3.max(flatData, d => d.value);
  const maxItems = flatData.filter(d => d.value === maxVal);
  const topCategories = maxItems.map(d => `${d.category} (nhóm ${d.ageGroup})`).join(", ");

  let comment = "";
  if (topAgeGroup && maxVal && topCategories) {
    comment = `Nhận xét với giới tính <b>${genderFilter === "female" ? "nữ" : "nam"}</b>:
      <li>Nhóm tuổi chi tiêu cao nhất: <b>${topAgeGroup[0]}</b> với <b>${topAgeGroup[1].toLocaleString()}</b> doanh thu.</li>
      <li>Danh mục nổi bật nhất: <b>${topCategories}</b> với <b>${maxVal.toLocaleString()}</b>.</li>`;
    comment += '<br><b>Đề xuất:</b> Tăng cường các chương trình thành viên, ưu đãi đối với nhóm tuổi trung niên (Từ 30 đến 50 tuổi).';
    document.getElementById("bar-comment").innerHTML = comment;
  }
}


function drawLineChartByMonth(data, selectedYear) {
  const svg = d3.select("#line-chart");
  const margin = { top: 30, right: 100, bottom: 50, left: 60 };
  const width = +svg.attr("width") - margin.left - margin.right;
  const height = +svg.attr("height") - margin.top - margin.bottom;

  svg.selectAll("*").remove(); 

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const monthly = d3.rollup(
    data,
    v => d3.sum(v, d => d["Total Amount"]),
    d => d3.timeFormat("%m")(d.Date),
    d => d["Product Category"]
  );

  const finalData = [];
  for (const [month, catMap] of monthly.entries()) {
    for (const [cat, value] of catMap.entries()) {
      finalData.push({ Month: month, Category: cat, Value: value });
    }
  }

  const months = ["01","02","03","04","05","06","07","08","09","10","11","12"];
  const categories = Array.from(new Set(finalData.map(d => d.Category)));

  const x = d3.scalePoint().domain(months).range([0, width]);
  const y = d3.scaleLinear().domain([0, d3.max(finalData, d => d.Value)]).nice().range([height, 0]);
  const color = d3.scaleOrdinal().domain(categories).range(d3.schemeTableau10);

  const line = d3.line()
    .x(d => x(d.Month))
    .y(d => y(d.Value));

  const nested = d3.groups(finalData, d => d.Category);

  // Dữ liệu hoàn chỉnh theo từng category
  nested.forEach(([category, values]) => {
    const monthMap = new Map(values.map(d => [d.Month, d]));
    const fullValues = months.map(m => monthMap.get(m) || { Month: m, Value: 0 });

    // Line path
    g.append("path")
      .datum(fullValues)
      .attr("fill", "none")
      .attr("stroke", color(category))
      .attr("stroke-width", 2)
      .attr("d", line)
      .attr("opacity", 0)
      .transition()
      .duration(800)
      .attr("opacity", 1);

    // Circle points with transition
    g.selectAll(`.dot-${category}`)
      .data(fullValues)
      .join("circle")
      .attr("class", `dot-${category}`)
      .attr("cx", d => x(d.Month))
      .attr("cy", d => y(0)) // start from bottom
      .attr("r", 4)
      .attr("fill", color(category))
      .on("mouseover", function (event, d) {
        d3.select(".d3-tooltip")
          .style("visibility", "visible")
          .style("opacity", 1)
          .html(`<b>Tháng ${+d.Month}</b><br>${category}: ${d.Value.toLocaleString()}`)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", function () {
        d3.select(".d3-tooltip").style("visibility", "hidden").style("opacity", 0);
      })
      .transition()
      .duration(800)
      .attr("cy", d => y(d.Value));
  });

  // Trục
  g.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x).tickFormat(m => `Tháng ${+m}`));
  g.append("g").call(d3.axisLeft(y));

  // Legend
  const legend = svg.append("g").attr("transform", `translate(${width + margin.left + 10},${margin.top})`);
  categories.forEach((cat, i) => {
    legend.append("rect").attr("x", 0).attr("y", i * 20).attr("width", 10).attr("height", 10).attr("fill", color(cat));
    legend.append("text").attr("x", 15).attr("y", i * 20 + 9).text(cat).style("font-size", "12px");
  });

  // Nhận xét theo ngành: tháng nào cao nhất trong năm
const categoryMonthSum = d3.rollup(
  data,
  v => d3.sum(v, d => d["Total Amount"]),
  d => d["Product Category"],
  d => d3.timeFormat("%m")(d.Date)
);

let commentText = `<b> Nhận xét: năm ${selectedYear}</b>`;

for (const [category, monthMap] of categoryMonthSum.entries()) {
  const sortedMonths = Array.from(monthMap.entries()).sort((a, b) => b[1] - a[1]); // Sắp xếp giảm dần theo doanh số
  const topMonth = sortedMonths[0];   // Tháng có doanh số cao nhất
  const lowMonth = sortedMonths[sortedMonths.length - 1]; // Tháng có doanh số thấp nhất

  if (topMonth && lowMonth) {
    commentText += `<li>Ngành <b>${category}</b> đạt doanh số 
      <b>cao nhất</b> vào tháng <b>${+topMonth[0]}</b> với <b>${topMonth[1].toLocaleString()}</b>, 
      <b>thấp nhất</b> vào tháng <b>${+lowMonth[0]}</b> với <b>${lowMonth[1].toLocaleString()}</b>.</li>`;
  }
}

commentText += `<p><b>Đề xuất:</b> Tăng cường khuyến mãi theo mùa dựa vào tháng cao điểm của từng ngành.</p>`;
document.getElementById("line-comment").innerHTML = commentText;
// Y-axis label
svg.append("text")
  .attr("transform", `rotate(-90)`)
  .attr("x", - (margin.top + height / 2))
  .attr("y", 15)
  .attr("text-anchor", "middle")
  .style("font-size", "14px")
  .text("Tổng doanh thu");

}

