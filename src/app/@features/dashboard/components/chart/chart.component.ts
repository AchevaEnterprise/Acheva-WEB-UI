import { Component } from '@angular/core';
import { HighchartsChartComponent } from 'highcharts-angular';

@Component({
  selector: 'app-chart',
  imports: [HighchartsChartComponent],
  templateUrl: './chart.component.html',
  styleUrl: './chart.component.scss',
})
export class ChartComponent {
  updateFlag = false;
  chartOptions: Highcharts.Options = {
    chart: {
      type: 'column',
      backgroundColor: 'transparent',
    },
    title: undefined,

    xAxis: {
      categories: ['CSC 101', 'CSC 102', 'CSC 103', 'CSC 104', 'CSC 105'],
      crosshair: true,
    },

    yAxis: {
      min: 0,
      max: 100,
      labels: {
        format: '{value}%',
      },
      title: undefined,
    },

    tooltip: {
      pointFormat:
        '<span style="color:{series.color}">{series.name}</span>: ' +
        '<b>{point.percentage:.1f}%</b><br/>',
    },

    plotOptions: {
      column: {
        stacking: 'percent',
        pointPadding: 0.2,
        borderWidth: 0,
      },
    },

    credits: {
      enabled: false,
    },

    accessibility: {
      enabled: false,
    },

    series: [
      {
        type: 'column',
        name: 'Pass Rate',
        data: [10, 28, 70, 64, 54],
      },
      {
        type: 'column',
        name: 'Fail Rate',
        data: [45, 30, 100, 20, 40],
      },
    ],
  };
}
