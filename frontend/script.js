document.getElementById('predictForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const column = document.getElementById('column').value;
    const days = document.getElementById('days').value;

    try {
        const response = await fetch('http://localhost:5000/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ column_name: column, days })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Unknown server error');
        }

        if (data.error) {
            throw new Error(data.error);
        }

        console.log('Received data:', data); // Log the server response

        const pastValues = data.past_values;
        const testActual = data.test_actual;
        const testPredicted = data.test_predicted;
        const futurePredicted = data.future_predicted;

        const labels = [
            ...Array(pastValues.length).keys(),
            ...Array(testActual.length).keys().map(i => i + pastValues.length),
            ...Array(futurePredicted.length).keys().map(i => i + pastValues.length + testActual.length)
        ];

        const chartData = {
            labels: labels,
            datasets: [
                { label: 'Past Values', data: pastValues, borderColor: 'blue', fill: false },
                { label: 'Test Actual', data: [...Array(pastValues.length).fill(null), ...testActual], borderColor: 'green', fill: false },
                { label: 'Test Predicted', data: [...Array(pastValues.length).fill(null), ...testPredicted], borderColor: 'orange', borderDash: [5, 5], fill: false },
                { label: 'Future Predicted', data: [...Array(pastValues.length + testActual.length).fill(null), ...futurePredicted], borderColor: 'red', borderDash: [5, 5], fill: false }
            ]
        };

        // Safely destroy the existing chart
        if (window.salesChart && typeof window.salesChart.destroy === 'function') {
            console.log('Destroying existing chart');
            window.salesChart.destroy();
        } else {
            console.log('No chart to destroy or destroy not a function');
        }

        // Create new chart
        const ctx = document.getElementById('salesChart').getContext('2d');
        window.salesChart = new Chart(ctx, {
            type: 'line',
            data: chartData,
            options: {
                responsive: true,
                scales: {
                    x: { title: { display: true, text: 'Time' } },
                    y: { title: { display: true, text: 'Sales' } }
                },
                plugins: { legend: { position: 'top' } }
            }
        });
        console.log('Chart created successfully');
    } catch (error) {
        console.error('Frontend error:', error);
        alert(`Failed to generate prediction: ${error.message}`);
    }
});