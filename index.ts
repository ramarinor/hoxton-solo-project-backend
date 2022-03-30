import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import 'dotenv/config';

const MY_SECRET = process.env.MY_SECRET as string;
const USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  username: true,
  image: true,
  roleId: true
};
const PORT = 4000;

const app = express();
app.use(cors());
app.use(express.json());
const prisma = new PrismaClient({ log: ['query', 'info', 'warn', 'error'] });

function createToken(id: number) {
  const token = jwt.sign({ id: id }, MY_SECRET, {
    expiresIn: '3days'
  });
  return token;
}

async function getUserFromToken(token: string) {
  const data = jwt.verify(token, MY_SECRET) as { id: number };
  const user = await prisma.user.findUnique({
    where: { id: data.id },
    select: USER_SELECT
  });

  return user;
}

app.post('/sign-up', async (req, res) => {
  const { firstName, lastName, username, password, image } = req.body;

  try {
    const hash = bcrypt.hashSync(password);
    const user = await prisma.user.create({
      data: { firstName, lastName, username, password: hash, image },
      select: USER_SELECT
    });
    res.send({ user, token: createToken(user.id) });
  } catch (err) {
    res.status(400).send({
      error: "The username you're trying to use already exists!"
    });
  }
});

app.listen(PORT, () => console.log(`Server up on http://localhost:${PORT}`));
