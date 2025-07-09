export interface ILogIn {
  email: string;
  password: string;
}

export interface ISignUp {
  first_name: string;
  last_name: string;
  middle_name: string;
  email_address: string;
  faculty: string;
  department: string;
  title: string;
  role: string;
  password: string;
}

export interface IAccount {
  id: string;
  name: string;
  email: string;
  role: 'advisor' | 'cordinator';
}

export interface IAuthProfile {
  first_name: string;
  last_name: string;
  middle_name: string;
  email_address: string;
  faculty: string;
  department: string;
  title: string;
  role: string;
}
