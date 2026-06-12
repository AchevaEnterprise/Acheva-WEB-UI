import {
  Directive,
  HostListener,
  ElementRef,
  input,
  inject,
} from '@angular/core';

const PROFILE_PLACEHOLDER_SVG = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHJ4PSIxMiIgZmlsbD0iI0Q0RTlGRiIvPjxwYXRoIGQ9Ik01IDIwVjE5QzUgMTcuMTQzNSA1LjczNzUgMTUuMzYzIDcuMDUwMjUgMTQuMDUwM0M4LjM2MzAxIDEyLjczNzUgMTAuMTQzNSAxMiAxMiAxMk0xMiAxMkMxMy44NTY1IDEyIDE1LjYzNyAxMi43Mzc1IDE2Ljk0OTcgMTQuMDUwM0MxOC4yNjI1IDE1LjM2MyAxOSAxNy4xNDM1IDE5IDE5VjIwTTEyIDEyQzEzLjA2MDkgMTIgMTQuMDc4MyAxMS41Nzg2IDE0LjgyODQgMTAuODI4NEM1LjU3ODYgMTAuMDc4MyAxNiA5LjA2MDg3IDE2IDhDMTYgNi45MzkxMyAxNS41Nzg2IDUuOTIxNzIgMTQuODI4NCA1LjE3MTU3QzE0LjA3ODMgNC40MjE0MyAxMy4wNjA5IDQgMTIgNEMxMC45MzkxIDQgOS45MjE3MiA0LjQyMTQzIDkuMTcxNTcgNS4xNzE1N0M4LjQyMTQzIDUuOTIxNzIgOCA2LjkzOTEzIDggOEM4IDkuMDYwODcgOC40MjE0MyAxMC4wNzgzIDkuMTcxNTcgMTAuODI4NEM5LjkyMTcyIDExLjU3ODYgMTAuOTM5MSAxMiAxMiAxMloiIHN0cm9rZT0iIzIwN0FENCIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjwvc3ZnPg==';

@Directive({
  selector: 'img[appImageFallback]',
  standalone: true,
})
export class ImageFallbackDirective {
  private readonly el = inject(ElementRef<HTMLImageElement>);
  appImageFallback = input<string>();

  @HostListener('error')
  onError() {
    const img: HTMLImageElement = this.el.nativeElement as HTMLImageElement;
    const fallback = this.appImageFallback();

    if (fallback === 'icons/general/profile-pic-placeholder.svg') {
      img.src = PROFILE_PLACEHOLDER_SVG;
    } else if (img.src !== fallback) {
      img.src = fallback!;
    }
  }
}
