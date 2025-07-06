import {
  Directive,
  HostListener,
  ElementRef,
  input,
  inject,
} from '@angular/core';

@Directive({
  selector: 'img[appImageFallback]',
})
export class ImageFallbackDirective {
  private readonly el = inject(ElementRef<HTMLImageElement>);
  appImageFallback = input<string>();

  @HostListener('error')
  onError() {
    const img: HTMLImageElement = this.el.nativeElement as HTMLImageElement;
    if (img.src !== this.appImageFallback()) img.src = this.appImageFallback()!;
  }
}
