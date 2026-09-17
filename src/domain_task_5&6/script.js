const weekDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const monthNames = [
    "Tất cả", "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
    "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"
];

function parseDateVN(str) {
    if (!str) return null;
    const [day, month, year] = str.split("/").map(Number);
    return new Date(year, month - 1, day);
}

function getWeekDay(date) {
    return weekDays[(date.getDay() + 6) % 7];
}

function getMonth(date) {
    return date.getMonth() + 1;
}

function getYear(date) {
    return date.getFullYear();
}

d3.csv("../../data/final_data.csv").then(rawData => {
    // Lọc các dòng có trường Date hợp lệ
    const data = rawData.filter(d => d["Date"]);

    // Parse ngày và thêm trường dateObj, month, year
    data.forEach(d => {
        d.dateObj = parseDateVN(d["Date"]);
        d.month = d.dateObj ? getMonth(d.dateObj) : null;
        d.year = d.dateObj ? getYear(d.dateObj) : null;
    });

    

    // Lấy danh sách năm có trong dữ liệu
    const years = Array.from(new Set(data.map(d => d.year))).sort((a, b) => a - b);
    years.unshift("Tất cả");
    const months = Array.from({ length: 13 }, (_, i) => i); // 0: Tất cả, 1-12: tháng

    // Tạo dropdown năm
    const yearSelect = d3.select("#year-select");
    yearSelect.selectAll("option")
        .data(years)
        .enter()
        .append("option")
        .attr("value", d => d)
        .text(d => d === "Tất cả" ? "Tất cả năm" : d);

    // Tạo dropdown tháng
    const monthSelect = d3.select("#month-select");
    monthSelect.selectAll("option")
        .data(months)
        .enter()
        .append("option")
        .attr("value", d => d)
        .text(d => monthNames[d]);

    // Hàm vẽ chart
    function drawChart(selectedYear, selectedMonth) {
        // Lọc dữ liệu theo năm và tháng
        let filtered = data.filter(d => d.dateObj);
        if (selectedYear !== "Tất cả") {
            filtered = filtered.filter(d => d.year == selectedYear);
            if (selectedMonth !== 0 && selectedMonth !== "0") {
                filtered = filtered.filter(d => d.month == selectedMonth);
            }
        }

        // Đếm số giao dịch theo thứ
        const counts = weekDays.map(day => ({ day, count: 0 }));
        filtered.forEach(d => {
            const day = getWeekDay(d.dateObj);
            const obj = counts.find(c => c.day === day);
            if (obj) obj.count += 1;
        });

        // Xóa chart cũ
        d3.select("#chart").selectAll("*").remove();

        // Vẽ lại chart (bar chart)
        const margin = { top: 20, right: 30, bottom: 30, left: 40 },
            width = 600 - margin.left - margin.right,
            height = 300 - margin.top - margin.bottom;

        const svg = d3.select("#chart")
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        const x = d3.scaleBand()
            .domain(weekDays)
            .range([0, width])
            .padding(0.2);

        const y = d3.scaleLinear()
            .domain([0, d3.max(counts, d => d.count) || 1])
            .nice()
            .range([height, 0]);

        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x));

        svg.append("g")
            .call(d3.axisLeft(y));

        // Tooltip
        const tooltip = d3.select("body")
            .append("div")
            .style("position", "absolute")
            .style("background", "#fff")
            .style("border", "1px solid #b0b8c1")
            .style("padding", "8px 14px")
            .style("border-radius", "8px")
            .style("pointer-events", "none")
            .style("font-size", "15px")
            .style("color", "#2d3a4b")
            .style("box-shadow", "0 2px 8px rgba(0,0,0,0.08)")
            .style("opacity", 0);

        svg.selectAll("rect")
            .data(counts)
            .enter()
            .append("rect")
            .attr("x", d => x(d.day))
            .attr("y", y(0))
            .attr("width", x.bandwidth())
            .attr("height", 0)
            .attr("fill", "#0074d9")
            .on("mouseover", function (event, d) {
                d3.select(this)
                    .transition()
                    .duration(150)
                    .attr("fill", "#2ecc40");
                tooltip
                    .style("opacity", 1)
                    .html(`<b>${d.day}</b><br>Số giao dịch: <b>${d.count}</b>`);
            })
            .on("mousemove", function (event) {
                tooltip
                    .style("left", (event.pageX + 16) + "px")
                    .style("top", (event.pageY - 24) + "px");
            })
            .on("mouseout", function () {
                d3.select(this)
                    .transition()
                    .duration(150)
                    .attr("fill", "#0074d9");
                tooltip.style("opacity", 0);
            })
            .transition()
            .duration(900)
            .attr("y", d => y(d.count))
            .attr("height", d => height - y(d.count));

        // Nhận xét
        let comment = "";
        if (filtered.length === 0) {
            comment = "Không có dữ liệu cho lựa chọn này.";
        } else {
            const maxCount = Math.max(...counts.map(d => d.count));
            const minCount = Math.min(...counts.map(d => d.count));
            const maxDays = counts.filter(d => d.count === maxCount).map(d => d.day);
            const minDays = counts.filter(d => d.count === minCount).map(d => d.day);

            comment = `Ngày có nhiều giao dịch nhất là <b>${maxDays.join(", ")}</b> với <b>${maxCount}</b> giao dịch. `;
            comment += `Ngày ít giao dịch nhất là <b>${minDays.join(", ")}</b> với <b>${minCount}</b> giao dịch. `;
            comment += "Biểu đồ cho thấy sự phân bố giao dịch trong tuần, giúp nhận diện các ngày cao điểm và thấp điểm.";
        }
        document.getElementById("chart-comment").innerHTML = comment;
    }

    // Sự kiện khi chọn năm/tháng
    yearSelect.on("change", function () {
        const selectedYear = this.value;
        if (selectedYear === "Tất cả") {
            monthSelect.property("disabled", true);
            monthSelect.property("value", 0);
            drawChart(selectedYear, 0);
        } else {
            monthSelect.property("disabled", false);
            drawChart(selectedYear, +monthSelect.node().value);
        }
    });
    monthSelect.on("change", function () {
        drawChart(yearSelect.node().value, +this.value);
    });

    // Ban đầu disable chọn tháng
    monthSelect.property("disabled", true);

    // Vẽ chart lần đầu (tất cả)
    drawChart("Tất cả", 0);
});

// DOMAIN TASK 6: Pie chart tỷ lệ giao dịch theo danh mục sản phẩm, filter theo giới tính và nhóm tuổi

function getAgeGroup(age) {
    age = +age;
    if (isNaN(age)) return "unknown";
    if (age < 20) return "<20";
    if (age < 30) return "20-29";
    if (age < 40) return "30-39";
    if (age < 50) return "40-49";
    if (age < 60) return "50-59";
    return ">=60";
}

d3.csv("../../data/final_data.csv").then(data => {
    // Chuẩn hóa dữ liệu
    data.forEach(d => {
        d.Category = d["Product Category"];
        d.Gender = d["Gender"];
        d.AgeGroup = getAgeGroup(d["Age"]);
    });

    // Lấy danh sách category
    const categories = Array.from(new Set(data.map(d => d.Category)));
    const color = d3.scaleOrdinal()
        .domain(categories)
        .range(d3.schemeSet2);

    function drawPie(genderFilter = "all", ageGroupFilter = "all") {
        // Lọc dữ liệu
        let filtered = data;
        if (genderFilter !== "all") {
            filtered = filtered.filter(d => d.Gender === genderFilter);
        }
        if (ageGroupFilter !== "all") {
            filtered = filtered.filter(d => d.AgeGroup === ageGroupFilter);
        }

        // Đếm số giao dịch theo category
        const counts = d3.rollup(
            filtered,
            v => v.length,
            d => d.Category
        );
        const pieData = Array.from(counts, ([key, value]) => ({ category: key, value }));

        // Xóa pie cũ
        d3.select("#pie").selectAll("*").remove();

        // Nếu không có dữ liệu
        if (pieData.length === 0) {
            d3.select("#pie").append("div")
                .style("text-align", "center")
                .style("color", "#888")
                .style("font-size", "18px")
                .text("Không có dữ liệu cho lựa chọn này.");
            document.getElementById("pie-comment").innerHTML = "";
            return;
        }

        // Vẽ pie chart
        const width = 420, height = 320, margin = 30, radius = Math.min(width, height) / 2 - margin;
        const svg = d3.select("#pie")
            .append("svg")
            .attr("width", width)
            .attr("height", height)
            .append("g")
            .attr("transform", `translate(${width / 2},${height / 2})`);

        const pie = d3.pie()
            .sort(null)
            .value(d => d.value);

        const data_ready = pie(pieData);

        // Arc generator
        const arc = d3.arc()
            .innerRadius(0)
            .outerRadius(radius);

        // Tooltip
        const tooltip = d3.select("body")
            .append("div")
            .attr("class", "d3-tooltip")
            .style("opacity", 0);

        // Vẽ lát cắt
        svg.selectAll('path')
            .data(data_ready)
            .enter()
            .append('path')
            .attr('d', arc)
            .attr('fill', d => color(d.data.category))
            .attr("stroke", "#fff")
            .style("stroke-width", "2px")
            .style("opacity", 0.85)
            .on("mouseover", function (event, d) {
                d3.select(this)
                    .transition()
                    .duration(150)
                    .attr("transform", function (d) {
                        // Đẩy lát cắt ra ngoài một chút
                        const [x, y] = arc.centroid(d);
                        return `translate(${x * 0.08},${y * 0.08})`;
                    })
                    .style("opacity", 1);
                tooltip
                    .style("opacity", 1)
                    .html(
                        `<b>${d.data.category}</b><br>
                        Số giao dịch: <b>${d.data.value}</b><br>
                        Tỷ lệ: <b>${(d.data.value / d3.sum(pieData, d => d.value) * 100).toFixed(1)}%</b>`
                    );
            })
            .on("mousemove", function (event) {
                tooltip
                    .style("left", (event.pageX + 16) + "px")
                    .style("top", (event.pageY - 24) + "px");
            })
            .on("mouseout", function () {
                d3.select(this)
                    .transition()
                    .duration(150)
                    .attr("transform", "translate(0,0)")
                    .style("opacity", 0.85);
                tooltip.style("opacity", 0);
            });

        // Hiển thị nhãn phần trăm trên lát cắt
        svg.selectAll('text')
            .data(data_ready)
            .enter()
            .append('text')
            .text(d => d.data.value > 0 ? `${(d.data.value / d3.sum(pieData, d => d.value) * 100).toFixed(1)}%` : "")
            .attr("transform", d => {
                const [x, y] = arc.centroid(d);
                return `translate(${x * 1.25},${y * 1.25})`;
            })
            .style("text-anchor", "middle")
            .style("font-size", "15px")
            .style("fill", "#2d3a4b")
            .style("font-weight", "bold");

        // Legend
        // const legend = svg.append("g")
        //     .attr("transform", `translate(${radius + 30},${-radius})`);
        // legend.selectAll("rect")
        //     .data(pieData)
        //     .enter()
        //     .append("rect")
        //     .attr("x", 0)
        //     .attr("y", (d, i) => i * 28)
        //     .attr("width", 20)
        //     .attr("height", 20)
        //     .attr("fill", d => color(d.category));
        // legend.selectAll("text")
        //     .data(pieData)
        //     .enter()
        //     .append("text")
        //     .attr("x", 28)
        //     .attr("y", (d, i) => i * 28 + 14)
        //     .text(d => d.category)
        //     .style("font-size", "15px")
        //     .attr("alignment-baseline", "middle");

        // Nhận xét tự động
        const maxVal = d3.max(pieData, d => d.value);
        const maxCats = pieData.filter(d => d.value === maxVal).map(d => d.category);
        let comment = `Danh mục có nhiều giao dịch nhất là <b>${maxCats.join(", ")}</b> với <b>${maxVal}</b> giao dịch. `;
        comment += "Biểu đồ cho thấy tỷ trọng từng nhóm sản phẩm trong tổng số giao dịch.";
        document.getElementById("pie-comment").innerHTML = comment;

        // Xóa legend cũ nếu có
        d3.select("#pie").selectAll(".pie-legend").remove();

        // Tạo legend dưới chart
        const legendDiv = d3.select("#pie")
            .append("div")
            .attr("class", "pie-legend");

        legendDiv.selectAll(".pie-legend-item")
            .data(pieData)
            .enter()
            .append("div")
            .attr("class", "pie-legend-item")
            .html(d => `<span class="pie-legend-color" style="background:${color(d.category)}"></span>${d.category}`);
    }

    // Sự kiện filter
    d3.select("#pie-gender-select").on("change", function () {
        drawPie(this.value, d3.select("#pie-agegroup-select").property("value"));
    });
    d3.select("#pie-agegroup-select").on("change", function () {
        drawPie(d3.select("#pie-gender-select").property("value"), this.value);
    });

    // Vẽ lần đầu
    drawPie("all", "all");
});

