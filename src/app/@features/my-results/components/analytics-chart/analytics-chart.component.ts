import { Component, computed, input } from '@angular/core';
import { HighchartsChartComponent } from 'highcharts-angular';

@Component({
  selector: 'app-analytics-chart',
  imports: [HighchartsChartComponent],
  templateUrl: './analytics-chart.component.html',
  styleUrl: './analytics-chart.component.scss',
})
export class AnalyticsChartComponent {
  data = input<number[]>([]);
  updateFlag = false;

  chartOptions = computed<Highcharts.Options>(() => {
    const data = [...this.data()];

    const colorMap = [
      '#2793FF',
      '#2793FF',
      '#4BA5FF',
      '#4BA5FF',
      '#E57692',
      '#D8315B',
    ];

    const dataSeries = data.map((value, index) => ({
      y: value,
      color: colorMap[index] ?? '#D8315B',
    }));

    this.updateFlag = !this.updateFlag;

    return {
      chart: {
        type: 'bar',
        backgroundColor: 'transparent',
      },
      title: undefined,
      xAxis: {
        categories: ['A', 'B', 'C', 'D', 'E', 'F'],
        title: undefined,
        gridLineWidth: 1,
        lineWidth: 0,
      },
      yAxis: {
        min: 0,
        title: undefined,
        allowDecimals: false,
        labels: {
          overflow: 'justify',
        },
        gridLineWidth: 0,
      },
      plotOptions: {
        bar: {
          borderRadius: '30%',
          dataLabels: {
            enabled: true,
          },
          groupPadding: 0,
        },
      },
      legend: {
        enabled: false,
      },
      credits: {
        enabled: false,
      },
      accessibility: {
        enabled: false,
      },
      series: [
        {
          type: 'bar',
          name: 'Results',
          data: dataSeries,
        },
      ],
    };
  });
}
