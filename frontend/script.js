let stockChart;

        // Load Companies List with Search
        $(document).ready(function () {
            $(".loading").show();
            $.get("http://127.0.0.1:5000/companies", function (companies) {
                companies.forEach(company => {
                    $("#company-list").append(
                        `<li class="list-group-item company" onclick="fetchStockData('${company}'); $(this).addClass('active').siblings().removeClass('active')">${company}</li>`
                    );
                });
                $(".loading").hide();
            }).fail(function () {
                alert("Failed to load company list.");
                $(".loading").hide();
            });

            // Company Search Filter
            $("#company-search").on("input", function () {
                let value = $(this).val().toLowerCase();
                $("#company-list .company").each(function () {
                    $(this).toggle($(this).text().toLowerCase().includes(value));
                });
            });

            // Add event listeners for automatic updates
            $("#stock-type, #graph-type, #date-range").on("change", function() {
                let company = $("#company-list .active").text();
                if (company) fetchStockData(company);
            });
        });

        // Fetch stock data with loading state
        function fetchStockData(company) {
            let stockType = $("#stock-type").val();
            let dateRange = $("#date-range").val();
            let url = `http://127.0.0.1:5000/company?company=${company}&stock_type=${stockType}&date_range=${dateRange}`;
            
            $(".chart-container .loading-overlay").addClass("active");

            return $.ajax({
                url: url,
                method: 'GET',
                dataType: 'json',
                success: function(data) {
                    console.log("Received data:", data);
                    
                    // Check if data is an array and has content
                    if (!Array.isArray(data)) {
                        console.error("Data is not an array:", data);
                        alert(`Invalid data format received for ${company}`);
                        return;
                    }

                    // Remove duplicate entries based on date
                    const uniqueData = removeDuplicates(data, 'index_date');
                    console.log("Data after removing duplicates:", uniqueData);
                    
                    // Validate and clean the data
                    const cleanData = uniqueData.filter(item => {
                        return item && 
                               item.index_date && 
                               !isNaN(parseFloat(item[stockType])) &&
                               item[stockType] !== null &&
                               item[stockType] !== undefined;
                    });
                    
                    if (cleanData.length === 0) {
                        alert(`No valid data found for ${company}. This might be due to missing or invalid values.`);
                        return;
                    }
                    
                    // Sort data by date
                    cleanData.sort((a, b) => new Date(a.index_date) - new Date(b.index_date));
                    
                    const latestData = cleanData[cleanData.length - 1];
                    console.log("Latest data point:", latestData);
                    
                    // Update chart
                    if (stockChart) {
                        $("#stockChart").fadeOut(300, function() {
                            drawChart(cleanData, stockType, company);
                            $(this).fadeIn(300, function() {
                                // Auto-trigger fullscreen mode after chart is drawn and faded in
                                toggleFullscreen(document.querySelector('.chart-container'));
                            });
                        });
                    } else {
                        drawChart(cleanData, stockType, company);
                        // Auto-trigger fullscreen mode after initial chart draw
                        toggleFullscreen(document.querySelector('.chart-container'));
                    }
                    
                    updateStatistics(latestData);
                },
                error: function(jqXHR, textStatus, errorThrown) {
                    console.error("Failed to fetch data for", company);
                    console.error("Error details:", {
                        status: jqXHR.status,
                        statusText: jqXHR.statusText,
                        responseText: jqXHR.responseText
                    });
                    
                    let errorMessage = `Failed to fetch data for ${company}. `;
                    if (jqXHR.status === 404) {
                        errorMessage += "Company data not found.";
                    } else if (jqXHR.status === 500) {
                        errorMessage += "Server error while processing data.";
                    } else {
                        errorMessage += "Multiple entries found.";
                    }
                    
                    alert(errorMessage);
                },
                complete: function() {
                    $(".chart-container .loading-overlay").removeClass("active");
                }
            });
        }

        // Add this new function to handle duplicate entries
        function removeDuplicates(array, key) {
            const seen = new Map();
            return array.filter(item => {
                if (!seen.has(item[key])) {
                    seen.set(item[key], true);
                    return true;
                }
                return false;
            });
        }

        // Draw Chart.js Line Chart with Tooltips
        function drawChart(data, stockType, company) {
            let ctx = document.getElementById("stockChart").getContext("2d");
            let graphType = $("#graph-type").val();
            
            if (stockChart) stockChart.destroy();

            const isDarkMode = $("body").hasClass("dark-mode");
            const gridColor = isDarkMode ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)";
            const textColor = isDarkMode ? "#e0e0e0" : "#2c3e50";

            // Clean and prepare the data, ensuring unique dates
            let chartData = data
                .map(d => ({
                    x: d.index_date,
                    y: parseFloat(d[stockType]) || null
                }))
                .filter(d => d.y !== null);

            // Sort data by date
            chartData.sort((a, b) => new Date(a.x) - new Date(b.x));

            stockChart = new Chart(ctx, {
                type: graphType,
                data: {
                    datasets: [{
                        label: `${company} - ${stockType.replace("_index_value", "").replace("_", " ")}`,
                        data: chartData,
                        borderColor: isDarkMode ? "#4dabf7" : "steelblue",
                        backgroundColor: isDarkMode ? "rgba(77, 171, 247, 0.1)" : "rgba(70, 130, 180, 0.2)",
                        borderWidth: 2,
                        fill: true,
                        tension: graphType === 'line' ? 0.3 : 0,
                        spanGaps: true
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        tooltip: {
                            backgroundColor: isDarkMode ? "rgba(30, 30, 30, 0.9)" : "rgba(0,0,0,0.8)",
                            borderRadius: 8,
                            padding: 10,
                        },
                        legend: {
                            labels: {
                                color: textColor
                            }
                        }
                    },
                    scales: {
                        x: { 
                            type: 'category',
                            title: { display: true, text: "Date", color: textColor },
                            ticks: { autoSkip: true, maxTicksLimit: 10, color: textColor },
                            grid: { color: gridColor }
                        },
                        y: { 
                            title: { display: true, text: "Stock Price", color: textColor },
                            ticks: { color: textColor },
                            grid: { color: gridColor }
                        }
                    },
                    animation: { duration: 1000, easing: "easeOutQuart" }
                }
            });
        }

        // Update Statistics with improved error handling and debugging
        function updateStatistics(latestData) {
            console.log("Updating statistics with:", latestData); // Debug log

            function updateStatWithColor(elementId, value, isPercentage = false) {
                const element = $(`#${elementId}`);
                console.log(`Updating ${elementId} with value:`, value); // Debug log
                
                // Handle null, undefined, and NaN values
                if (value === null || value === undefined || isNaN(value) || value === "") {
                    element.text("N/A").removeClass("positive negative");
                    return;
                }

                try {
                    // Convert to number and format
                    const numValue = Number(value);
                    const formattedValue = numValue.toFixed(2);
                    
                    // Update text
                    element.text(isPercentage ? formattedValue + "%" : formattedValue);
                    
                    // Update colors
                    if (numValue > 0) {
                        element.removeClass("negative").addClass("positive");
                    } else if (numValue < 0) {
                        element.removeClass("positive").addClass("negative");
                    } else {
                        element.removeClass("positive negative");
                    }
                } catch (error) {
                    console.error(`Error updating ${elementId}:`, error); // Debug log
                    element.text("N/A").removeClass("positive negative");
                }
            }

            // Make sure latestData exists
            if (!latestData) {
                console.error("No latest data available"); // Debug log
                return;
            }

            // Update each statistic with explicit property access
            updateStatWithColor("points-change", latestData.points_change);
            updateStatWithColor("change-percent", latestData.change_percent, true);
            updateStatWithColor("pe-ratio", latestData.pe_ratio);
            updateStatWithColor("pb-ratio", latestData.pb_ratio);
            updateStatWithColor("div-yield", latestData.div_yield, true);
        }

        // Dark Mode Toggle with Enhanced Animation
        function toggleDarkMode() {
            $("body").toggleClass("dark-mode");
            const isDark = $("body").hasClass("dark-mode");
            const icon = $(".dark-mode-toggle i");
            
            icon.toggleClass("fa-moon fa-sun");
            // Make moon icon darker when in light mode
            if (!isDark) {
                icon.css("color", "#1a1a1a"); // Dark gray color for better visibility
            } else {
                icon.css("color", ""); // Reset to default color in dark mode
            }
            
            // Redraw charts if they exist
            const activeCompany = $("#company-list .active").text();
            if (activeCompany) {
                fetchStockData(activeCompany);
            }
        }

        // Replace the existing toggleFullscreen function with these new functions
        function toggleFullscreen(element) {
            const chartModal = document.getElementById('chartModal');
            const modalChart = document.getElementById('modalChart');
            
            // Show the modal
            chartModal.style.display = 'flex';
            
            // Clone the chart data and config
            if (stockChart) {
                const newChart = new Chart(modalChart, {
                    type: stockChart.config.type,
                    data: JSON.parse(JSON.stringify(stockChart.data)),
                    options: {
                        ...stockChart.config.options,
                        responsive: true,
                        maintainAspectRatio: false
                    }
                });

                // Store the new chart instance
                window.modalChartInstance = newChart;
            }

            // Add event listener to close modal when clicking outside
            chartModal.addEventListener('click', function(e) {
                if (e.target === chartModal) {
                    closeModal();
                }
            });
        }

        function closeModal() {
            const chartModal = document.getElementById('chartModal');
            chartModal.style.display = 'none';
            
            // Destroy the modal chart instance to prevent memory leaks
            if (window.modalChartInstance) {
                window.modalChartInstance.destroy();
                window.modalChartInstance = null;
            }
        }

        // Add ESC key listener to close modal
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                closeModal();
            }
        });

        // After your company list is populated
        document.addEventListener('DOMContentLoaded', function() {
            // Show stats panel
            document.getElementById('stats-panel').style.display = 'block';
            
            // Get the first company from the list and load its data
            const companyList = document.getElementById('company-list');
            if (companyList.firstElementChild) {
                const firstCompany = companyList.firstElementChild;
                const companyId = firstCompany.getAttribute('data-company-id');
                // Highlight the first company
                firstCompany.classList.add('active');
                // Load the data for the first company
                loadCompanyData(companyId);
            }
        });