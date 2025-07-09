import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  Component,
  ElementRef,
  HostBinding,
  Input,
  OnChanges,
  OnDestroy,
  Renderer2,
  SimpleChanges,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-svg',
  imports: [CommonModule],
  template: '',
  styles: [
    `
      :host {
        display: flex;
        align-items: center;
        justify-content: center;
      }
    `,
  ],
})
export class SvgComponent implements OnChanges, OnDestroy {
  private readonly subscription = new Subscription();

  @Input() src!: string;
  @Input() svgClass!: string;
  @Input() svgId!: string;
  @Input() svgWidth!: string;
  @Input() svgHeight!: string;
  @Input() svgFill!: string;
  @Input() svgPathFill!: string;
  @Input() svgPathStroke!: string;
  @Input() svgRectFill!: string | null;
  @Input() svgRectWidth!: string | null;
  @Input() svgRectHeight!: string | null;
  @Input() svgRectStroke!: string;
  @Input() svgCircleFill!: string;
  @Input() svgCircleStroke!: string;
  @Input() svgPolygonFill!: string | null;
  @Input() svgPolygonSize!: number | null;

  @HostBinding('innerHTML') innerHTML!: SafeHtml;

  constructor(
    private readonly elementRef: ElementRef,
    private readonly http: HttpClient,
    private readonly renderer: Renderer2,
    private readonly sanitizer: DomSanitizer
  ) {}
  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['src'] ||
      changes['svgClass'] ||
      changes['svgId'] ||
      changes['svgWidth'] ||
      changes['svgHeight'] ||
      changes['svgFill'] ||
      changes['svgPathFill'] ||
      changes['svgPathStroke'] ||
      changes['svgRectFill'] ||
      changes['svgRectWidth'] ||
      changes['svgRectHeight'] ||
      changes['svgRectStroke'] ||
      changes['svgCircleFill'] ||
      changes['svgCircleStroke'] ||
      changes['svgPolygonFill'] ||
      changes['svgPolygonSize']
    ) {
      this.subscription.add(
        this.http.get(this.src, { responseType: 'text' }).subscribe((svg) => {
          this.renderer.setProperty(
            this.elementRef.nativeElement,
            'innerHTML',
            this.sanitizer.bypassSecurityTrustHtml(svg)
          );

          const svgElement = (this.elementRef.nativeElement as HTMLElement)
            .firstElementChild;

          // this.renderer.setStyle(svgElement, 'max-width', '100%');

          if (this.svgClass) {
            this.renderer.setAttribute(svgElement, 'class', this.svgClass);
          }

          if (this.svgId) {
            this.renderer.setAttribute(svgElement, 'id', this.svgId);
          }
          if (this.svgWidth) {
            this.renderer.setAttribute(svgElement, 'width', this.svgWidth);
          }
          if (this.svgHeight) {
            this.renderer.setAttribute(svgElement, 'height', this.svgHeight);
          }
          if (this.svgFill) {
            this.renderer.setAttribute(svgElement, 'fill', this.svgFill);
          }

          if (this.svgPathFill) {
            Array.from(svgElement!.children).forEach((el) => {
              if (el.tagName === 'path') {
                this.renderer.setAttribute(el, 'fill', this.svgPathFill);
              }
            });
          }

          if (this.svgPathStroke) {
            Array.from(svgElement!.children).forEach((el) => {
              if (el.tagName === 'path') {
                this.renderer.setAttribute(el, 'stroke', this.svgPathStroke);
              }
            });
          }

          if (this.svgRectFill) {
            Array.from(svgElement!.children).forEach((el) => {
              if (el.tagName === 'rect') {
                this.renderer.setAttribute(el, 'fill', this.svgRectFill!);
              }
            });
          }

          if (this.svgRectWidth) {
            Array.from(svgElement!.children).forEach((el) => {
              if (el.tagName === 'rect') {
                this.renderer.setAttribute(el, 'width', this.svgRectWidth!);
              }
            });
          }

          if (this.svgRectHeight) {
            Array.from(svgElement!.children).forEach((el) => {
              if (el.tagName === 'rect') {
                this.renderer.setAttribute(el, 'height', this.svgRectHeight!);
              }
            });
          }
          if (this.svgRectStroke) {
            Array.from(svgElement!.children).forEach((el) => {
              if (el.tagName === 'rect') {
                this.renderer.setAttribute(el, 'stroke', this.svgRectStroke!);
              }
            });
          }

          if (this.svgCircleFill) {
            Array.from(svgElement!.children).forEach((el) => {
              if (el.tagName === 'circle') {
                this.renderer.setAttribute(el, 'fill', this.svgCircleFill!);
              }
            });
          }

          if (this.svgCircleStroke) {
            Array.from(svgElement!.children).forEach((el) => {
              if (el.tagName === 'circle') {
                this.renderer.setAttribute(el, 'stroke', this.svgCircleStroke!);
              }
            });
          }

          if (this.svgPolygonFill) {
            Array.from(svgElement!.children).forEach((el) => {
              if (el.tagName === 'polygon') {
                this.renderer.setAttribute(el, 'fill', this.svgPolygonFill!);
              }
            });
          }

          if (this.svgPolygonSize) {
            Array.from(svgElement!.children).forEach((el) => {
              if (el.tagName === 'polygon') {
                const size = Math.floor(this.svgPolygonSize!);
                const midSize = Math.floor(this.svgPolygonSize! / 2);
                const points = `0,${size} ${midSize},0 ${size},${size}`;

                this.renderer.setAttribute(el, 'points', points);
              }
            });
          }

          this.innerHTML = this.sanitizer.bypassSecurityTrustHtml(
            svgElement!.outerHTML
          );
        })
      );
    }
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
}
