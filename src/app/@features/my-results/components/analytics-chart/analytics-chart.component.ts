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

  chartOptions = computed<Highcharts.Options>(() => {
    const data = this.data();

    if (!data) return {};

    const dataSeries = data.map((value, index) => {
      let color = '#D8315B';
      if (index === 0 || index === 1) {
        color = '#2793FF';
      } else if (index === 2 || index === 3) {
        color = '#4BA5FF';
      } else if (index === 4) {
        color = '#E57692';
      }
      return {
        y: value,
        color,
      };
    });

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
