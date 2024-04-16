import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './User';

@Entity({ name: 'user_profiles' })
export class Profile {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => User, (user) => user.profile)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    default: '',
  })
  firstname?: string;

  @Column({
    default: '',
  })
  lastname?: string;

  @Column({
    default: '',
  })
  username?: string;

  @Column()
  email: string;

  @Column({
    default: '',
  })
  phonenumber?: string;

  @Column({
    default: '',
  })
  country?: string;

  @Column({
    default: '',
  })
  state?: string;

  @Column({
    default: '',
  })
  address?: string;

  @Column({
    default: 0,
  })
  profile_created: number;

}