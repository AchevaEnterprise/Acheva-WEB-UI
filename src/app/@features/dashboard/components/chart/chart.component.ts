import { Component, computed, input, effect } from '@angular/core';
import * as Highcharts from 'highcharts';
import { HighchartsChartComponent } from 'highcharts-angular';

@Component({
  selector: 'app-chart',
  standalone: true,
  imports: [HighchartsChartComponent],
  templateUrl: './chart.component.html',
  styleUrl: './chart.component.scss',
})
export class ChartComponent {
  Highcharts: typeof Highcharts = Highcharts;

  chart = input<{ courseCode: string; passRate: number; failRate: number }[]>(
    []
  );

  updateFlag = false;

  constructor() {
    // Telling Highcharts to redraw is a SIDE EFFECT, so it belongs in an
    // effect rather than inside the computed that builds the options. Setting
    // it from the computed made the value change during rendering, which is
    // what Angular reports as NG0100.
    effect(() => {
      this.chart();
      this.updateFlag = true;
    });
  }

  chartOptions = computed<Highcharts.Options>(() => {
    const data = this.chart();

    return {
      chart: {
        type: 'column',
        backgroundColor: 'transparent',
      },

      title: undefined,

      xAxis: {
        categories: data.map((d) => d.courseCode),
        crosshair: true,
      },

      yAxis: {
        min: 0,
        max: 100,
        title: { text: 'Percentage (%)' },
        labels: {
          format: '{value}%',
        },
      },

      tooltip: {
        shared: true,
        valueSuffix: '%',
      },

      plotOptions: {
        column: {
          grouping: true,
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
          data: data.map((d) => Number(d.passRate.toFixed(2))),
        },
        {
          type: 'column',
          name: 'Fail Rate',
          data: data.map((d) => Number(d.failRate.toFixed(2))),
        },
      ],
    };
  });
}
