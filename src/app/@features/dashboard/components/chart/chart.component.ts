import { Component } from '@angular/core';
import { HighchartsChartComponent } from 'highcharts-angular';

@Component({
  selector: 'app-chart',
  imports: [HighchartsChartComponent],
  templateUrl: './chart.component.html',
  styleUrl: './chart.component.scss',
})
export class ChartComponent {
  chartOptions: Highcharts.Options = {
    chart: {
      type: 'area',
      backgroundColor: 'transparent',
    },
    accessibility: {
      enabled: false,
    },
    title: undefined,
    yAxis: {
      title: undefined,
      labels: {
        format: '{value}%',
      },
    },
    xAxis: {
      categories: [
        'CSC 101',
        'CSC 102',
        'CSC 103',
        'CSC 104',
        'CSC 105',
        'CSC 106',
        'CSC 107',
        'CSC 108',
        'CSC 109',
        'CSC 110',
      ],
      lineWidth: 0,
    },
    tooltip: {
      pointFormat:
        '<span style="color:{series.color}">{series.name}</span>' +
        ': <b>{point.percentage:.1f}%</b>',
      split: true,
    },
    plotOptions: {
      series: {
        pointPlacement: 'on',
        label: {
          style: {
            fontSize: '1.4em',
            opacity: 0.4,
          },
        },
      },
      area: {
        stacking: 'percent',
        marker: {
          enabled: true,
        },
      },
    },
    credits: {
      enabled: false,
    },
    series: [
      {
        type: 'area',
        name: 'Attendance Rate',
        color: '#A0CDFF',
        data: [20, 30, 50, 73, 50],
      },
      {
        type: 'area',
        name: 'Pass Rate',
        color: '#0D5ADA',
        data: [30, 40, 100, 64, 10],
      },
      {
        type: 'area',
        name: 'Fail Rate',
        color: '#8FAFFF',
        data: [50, 30, 73, 38, 70],
      },
    ],
  };
}
