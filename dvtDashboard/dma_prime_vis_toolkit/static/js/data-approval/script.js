d3.json('/data/respiratory/changed_files')
  .then((data) => {
    d3.select("#respiratory-panel .dashboard-data-buttons-container").append("sl-divider")
    var div = d3.select("#respiratory-panel .dashboard-data-buttons-container").append("div")
        .attr("class", "additional-info")
    
    for (var [category, values] of Object.entries(data)) {
        var cat = div.append("sl-details")
            
        cat.append("p")
            .attr("slot", "summary")
            .html(category[0].toUpperCase() + category.slice(1))

        var catContents = cat.append("div")
        
        for (var val of values) {
            catContents.append("p")
                .attr("class", "respiratory-changed-file")
                .html(val)
        }
    }
  })

tabGroup.addEventListener("sl-tab-show", function(e) {
    let dataVersionButton = d3.selectAll(`.preview-data-button[dashboard=${e.detail.name}][variant=primary]`)
    document.getElementById(`${e.detail.name}-dashboard`).src = `/${e.detail.name}?data_version=${dataVersionButton.attr("dataVersion")}`
})
tabGroup.addEventListener("sl-tab-hide", function(e) {
    try {
        document.getElementById(`${e.detail.name}-dashboard`).src = ""
    } catch (error) {
        
    }
})

d3.selectAll(".preview-data-button").on("click", function(d){
    document.getElementById(`${this.getAttribute("dashboard")}-dashboard`).src = `/${this.getAttribute("dashboard")}?data_version=${this.getAttribute("dataversion")}`
    d3.selectAll(`.preview-data-button[dashboard=${this.getAttribute("dashboard")}]`).attr("variant", "default")
    this.setAttribute("variant", "primary")
})

// List of dashboard codes (should match those in your Flask context)
const dashboards = [
    'respiratory',
    'wastewater',
    'outbreak-detection',
    'opioid-hcv-hiv',
    'mobile-health-clinics'
];

function updateApproveButtons(dashboard) {
    d3.json(`/data/get-date/all/${dashboard}`).then(dates => {
        // Overview approve button
        const overviewApproveBtn = document.getElementById(`${dashboard}-approve-button`);
        const overviewRow = document.getElementById(`${dashboard}-row`);
        if (overviewApproveBtn) {
            if (dates[dashboard].new === dates[dashboard].current) {
                overviewApproveBtn.setAttribute('disabled', true);
                if (overviewRow) overviewRow.classList.remove('highlight-approval-row');
            } else {
                overviewApproveBtn.removeAttribute('disabled');
                if (overviewRow) overviewRow.classList.add('highlight-approval-row');
            }
        }
        // Dashboard panel approve buttons
        d3.selectAll(`.approve-data-button[dashboard=${dashboard}][dataVersion=new]`).each(function() {
            if (dates[dashboard].new === dates[dashboard].current) {
                this.setAttribute('disabled', true);
            } else {
                this.removeAttribute('disabled');
            }
        });
    });
}

function approveDashboard(dashboard) {
    const approveBtn = document.getElementById(`${dashboard}-approve-button`);
    if (approveBtn && !approveBtn.disabled) {
        const requestOptions = {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 'change': 'new', 'dashboard': dashboard })
        };
        fetch('/data/change-version', requestOptions)
        .then(response => {
            updateDates(dashboard);
            updateApproveButtons(dashboard);
        });
    }
}

function approveAllDashboards() {
    dashboards.forEach(dashboard => approveDashboard(dashboard));
}

// On page load, update all approve buttons
window.addEventListener('DOMContentLoaded', function() {
    dashboards.forEach(dashboard => updateApproveButtons(dashboard));
    const approveAllBtn = document.getElementById('approve-all-button');
    if (approveAllBtn) {
        approveAllBtn.addEventListener('click', approveAllDashboards);
    }
});

d3.selectAll(".approve-data-button").on("click", function(d) {
    const requestOptions = {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 'change': this.getAttribute("dataversion"), 'dashboard': this.getAttribute("dashboard")})
    };

    fetch('/data/change-version', requestOptions)
    .then(response => {
        
        if (!this.classList.contains("overview")) {
            document.getElementById(`${this.getAttribute("dashboard")}-dashboard`).src = `/${this.getAttribute("dashboard")}?data_version=current`

            d3.selectAll(`.preview-data-button[dashboard=${this.getAttribute("dashboard")}]`).attr("variant", "default")
            d3.selectAll(`.preview-data-button[dataVersion=current][dashboard=${this.getAttribute("dashboard")}]`).node().setAttribute("variant", "primary")
        }
        updateDates(this.getAttribute("dashboard"))
        updateApproveButtons(this.getAttribute("dashboard")); // <-- Add this line to update button state after approval
    })
    
})

function updateDates(dashboard) {
    d3.json(`/data/get-date/all/${dashboard}`).then(dates => {
        Object.entries(dates[dashboard]).forEach(([version, date]) => {
            console.log(d3.selectAll(`.data-date[dataVersion=${version}][dashboard=${dashboard}]`))
            d3.selectAll(`.data-date[dataVersion=${version}][dashboard=${dashboard}]`).html(date)
            console.log(version, date)
        })
    })
}