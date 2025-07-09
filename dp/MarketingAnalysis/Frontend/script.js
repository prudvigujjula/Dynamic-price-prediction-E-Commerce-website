// WebSocket connection
const socket = new WebSocket('ws://localhost:3000');

// Chart setup
const salesChart = new Chart(document.getElementById('sales-chart'), {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Sales ($)',
            data: [],
            borderColor: '#1a73e8',
            tension: 0.3,
            fill: false
        }]
    },
    options: {
        responsive: true,
        scales: { y: { beginAtZero: true } }
    }
});

// Update dashboard
socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    updateDashboard(data);
};

function updateDashboard(data) {
    // Status Bar
    document.getElementById('last-updated').innerText = `Last Updated: ${new Date().toLocaleTimeString()}`;

    // Module 1: Real-Time Insights
    document.getElementById('heatmap').innerText = `Active Users: ${data.geoPulse.users || 0}`;
    salesChart.data.labels.push(new Date().toLocaleTimeString());
    salesChart.data.datasets[0].data.push(data.revenue || 0);
    if (salesChart.data.labels.length > 10) {
        salesChart.data.labels.shift();
        salesChart.data.datasets[0].data.shift();
    }
    salesChart.update();

    // Module 3: Influencer Management
    const influencerList = document.getElementById('influencer-list');
    influencerList.innerHTML = data.influencers?.map(i => `<div>${i.name} (${i.reach})</div>`).join('') || 'No influencers yet';
}

// Module 2: Pricing Control
const slider = document.getElementById('price-slider');
const priceOutput = document.getElementById('price-output');
const applyBtn = document.getElementById('apply-price');
const autoToggle = document.getElementById('auto-price-toggle');
slider.oninput = () => {
    priceOutput.innerText = `$${slider.value}`;
};
applyBtn.onclick = () => {
    socket.send(JSON.stringify({ type: 'priceUpdate', value: slider.value }));
};
autoToggle.onchange = () => {
    socket.send(JSON.stringify({ type: 'autoPrice', enabled: autoToggle.checked }));
};

// Module 3: Export Influencers
document.getElementById('export-influencers').onclick = () => {
    socket.send(JSON.stringify({ type: 'exportInfluencers' }));
    alert('Exporting influencer data... (Check console or implement file download)');
};

// Module 4: Campaign Studio
const uploadInput = document.getElementById('content-upload');
const preview = document.getElementById('content-preview');
const deployBtn = document.getElementById('deploy-campaign');
uploadInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = () => preview.innerHTML = `<img src="${reader.result}" alt="Campaign Asset">`;
        reader.readAsDataURL(file);
    }
};
deployBtn.onclick = () => {
    const fileName = uploadInput.files[0]?.name || 'unnamed';
    socket.send(JSON.stringify({ type: 'contentUpload', name: fileName }));
    deployBtn.innerText = 'Deployed!';
    setTimeout(() => deployBtn.innerText = 'Deploy Campaign', 1000);
};