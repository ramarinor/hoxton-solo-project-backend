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

function sortBydate(a: { createdAt: Date }, b: { createdAt: Date }) {
  if (a.createdAt > b.createdAt) return -1;
  else return 1;
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

app.post('/sign-in', async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { username } });
    // @ts-ignore
    const passwordMatches = bcrypt.compareSync(password, user.password);
    //@ts-ignore
    delete user.password;
    if (user && passwordMatches) {
      res.send({ user, token: createToken(user.id) });
    } else {
      throw Error('Boom');
    }
  } catch (err) {
    res.status(400).send({ error: 'Email/password invalid.' });
  }
});

app.get('/validate', async (req, res) => {
  const token = req.headers.authorization || '';

  try {
    const user = await getUserFromToken(token);
    res.send({ user });
  } catch (err) {
    res.status(400).send({ error: 'Session expired or invalid token' });
  }
});

app.get('/articles', async (req, res) => {
  console.log('first');
  try {
    const articles = await prisma.article.findMany();
    articles.sort(sortBydate);
    res.send(articles);
  } catch (err) {
    //@ts-ignore
    res.status(400).send({ error: err.messsage });
  }
});

app.get('/articles/:category', async (req, res) => {
  const category = req.params.category;
  console.log('test');
  try {
    const articles = await prisma.article.findMany({
      where: { category: { name: category } }
    });
    articles.sort(sortBydate);
    res.send(articles);
  } catch (err) {
    //@ts-ignore
    res.status(400).send({ error: err.messsage });
  }
});

app.get('/article/:id', async (req, res) => {
  const id = Number(req.params.id);
  try {
    const article = await prisma.article.findUnique({
      where: { id },
      include: { user: { select: USER_SELECT }, category: true }
    });
    if (article) {
      res.send({ article });
    } else {
      res.send({ error: 'Article not found' });
    }
  } catch (err) {
    //@ts-ignore
    res.status(400).send({ error: err.messsage });
  }
});

app.post('/articles', async (req, res) => {
  const token = req.headers.authorization || '';

  const { title, content, image, categoryId } = req.body;
  try {
    const user = await getUserFromToken(token);
    if (!user) {
      res
        .status(401)
        .send({ error: 'Please sign in as a Journalist to create an article' });
      return;
    }
    if (user.roleId === 3) {
      res.status(401).send({
        error:
          'Only journalist accounts can create articles. Please contact the admin to upgrade your role!'
      });
      return;
    }
    await prisma.article.create({
      data: { title, content, image, categoryId, userId: user.id }
    });
    res.send({ message: 'Article successfully created!' });
  } catch (err) {
    //@ts-ignore
    res
      .status(400)
      .send({ error: 'Please sign in as a Journalist to create an article' });
  }
});

app.listen(PORT, () => console.log(`Server up on http://localhost:${PORT}`));
