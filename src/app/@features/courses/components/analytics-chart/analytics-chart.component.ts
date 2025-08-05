import { Component } from '@angular/core';
import { HighchartsChartComponent } from 'highcharts-angular';

@Component({
  selector: 'app-analytics-chart',
  imports: [HighchartsChartComponent],
  templateUrl: './analytics-chart.component.html',
  styleUrl: './analytics-chart.component.scss',
})
export class AnalyticsChartComponent {
  chartOptions: Highcharts.Options = {
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
        name: 'Year 1990',
        data: [
          { y: 105, color: '#2793FF' },
          { y: 138, color: '#2793FF' },
          { y: 50, color: '#4BA5FF' },
          { y: 46, color: '#4BA5FF' },
          { y: 37, color: '#E57692' },
          { y: 56, color: '#D8315B' },
        ],
      },
    ],
  };
}
