import { Directive, HostBinding, HostListener, output } from '@angular/core';

@Directive({
  selector: '[appDragDrop]',
  standalone: true,
})
export class DragDropDirective {
  filesDropped = output<FileList>();
  filesHovered = output<boolean>();

  @HostBinding('class.fileover') isHovered = false;

  @HostListener('dragover', ['$event']) onDragOver(evt: DragEvent) {
    evt.preventDefault();
    evt.stopPropagation();
    this.isHovered = true;
    this.filesHovered.emit(true);
  }

  @HostListener('dragleave', ['$event']) onDragLeave(evt: DragEvent) {
    evt.preventDefault();
    evt.stopPropagation();
    this.isHovered = false;
    this.filesHovered.emit(false);
  }

  @HostListener('drop', ['$event']) onDrop(evt: DragEvent) {
    evt.preventDefault();
    evt.stopPropagation();

    this.isHovered = false;
    this.filesHovered.emit(false);

    if (evt.dataTransfer?.files?.length) {
      this.filesDropped.emit(evt.dataTransfer.files);
    }
  }
}
