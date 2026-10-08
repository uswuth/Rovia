import { prop, getModelForClass, pre, modelOptions, Severity } from '@typegoose/typegoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

@pre<ServerAdminClass>('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
})
@modelOptions({
  schemaOptions: {
    collection: 'server_admins',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: {
      virtuals: false,
      transform: (_doc, ret: Record<string, unknown>) => {
        return {
          adminId: (ret._id as { toString(): string })?.toString(),
          username: ret.username as string,
          email: ret.email as string,
          role: 'ServerAdmin',
          createdAt: ret.created_at,
          updatedAt: ret.updated_at
        };
      }
    }
  },
  options: { allowMixed: Severity.ALLOW }
})
export class ServerAdminClass {
  @prop({
    type: () => String,
    required: true,
    unique: true,
    trim: true
  })
  public username!: string;

  @prop({
    type: () => String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  })
  public email!: string;

  @prop({
    type: () => String,
    required: true,
    minlength: 6,
    select: false
  })
  public password!: string;

  public async comparePassword(candidatePassword: string): Promise<boolean> {
    return await bcrypt.compare(candidatePassword, this.password);
  }

  public generateAccessToken(): string {
    const docId = (this as unknown as { _id: { toString(): string } })._id.toString();
    return jwt.sign(
      {
        id: docId,
        username: this.username,
        email: this.email,
        role: 'ServerAdmin',
        isServerAdmin: true
      },
      env.JWT_ACCESS_SECRET,
      { expiresIn: env.JWT_ACCESS_EXPIRY } as jwt.SignOptions
    );
  }
}

export const ServerAdmin = getModelForClass(ServerAdminClass);
