import { Component, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ButtonComponent } from '../../../../@shared/components/forms/button/button.component';
import { CoursePreviewComponent } from '../../components/course-preview/course-preview.component';

@Component({
  selector: 'app-course-details',
  imports: [
    CoursePreviewComponent,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
    ButtonComponent,
  ],
  templateUrl: './course-details.component.html',
  styleUrl: './course-details.component.scss',
})
export class CourseDetailsComponent {
  // private readonly route = inject(ActivatedRoute);
  // private readonly courseTemplateId =
  //   this.route.snapshot.paramMap.get('templateId');

  form = signal<FormGroup>(
    new FormGroup({
      session: new FormControl('', Validators.required),
      semester: new FormControl(
        { value: '1st Semester', disabled: true },
        Validators.required
      ),
      course_title: new FormControl(
        { value: 'Database Management System', disabled: true },
        Validators.required
      ),
      course_code: new FormControl(
        { value: 'CSC 541', disabled: true },
        Validators.required
      ),
      course_cordinator: new FormControl(
        { value: 'Dr. Nnamdi Araka', disabled: true },
        Validators.required
      ),
      faculty: new FormControl('', Validators.required),
      department: new FormControl('', Validators.required),
      level: new FormControl(
        { value: '500', disabled: true },
        Validators.required
      ),
      course_unit: new FormControl(1, Validators.required),
    })
  );

  increaseCourseUnit() {
    let unit = this.form().get('course_unit')?.value as number;
    if (unit === 7) return;

    unit++;
    this.form().get('course_unit')?.setValue(unit);
  }

  decreaseCourseUnit() {
    let unit = this.form().get('course_unit')?.value as number;
    if (unit === 1) return;

    unit--;
    this.form().get('course_unit')?.setValue(unit);
  }

  submit() {}
}
