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
    res
      .status(400)
      .send({ error: 'Session expired or invalid token. Please login again' });
  }
});

app.get('/categories', async (req, res) => {
  try {
    const categories = await prisma.category.findMany();
    res.send(categories);
  } catch (err) {
    //@ts-ignore
    res.status(400).send({ error: err.messsage });
  }
});

app.get('/roles', async (req, res) => {
  try {
    const roles = await prisma.role.findMany();
    res.send(roles);
  } catch (err) {
    //@ts-ignore
    res.status(400).send({ error: err.messsage });
  }
});

app.get('/articles', async (req, res) => {
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
      include: { user: { select: USER_SELECT } }
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
    res
      .status(400)
      .send({ error: 'Please sign in as a Journalist to create an article' });
  }
});

app.patch('/articles/:id', async (req, res) => {
  const id = Number(req.params.id);
  const token = req.headers.authorization || '';
  const { title, content, image, categoryId } = req.body;
  try {
    const user = await getUserFromToken(token);
    const article = await prisma.article.findUnique({ where: { id } });
    if (!article) {
      res.status(404).send({ error: 'Article not found' });
      return;
    }
    if (!user) {
      res.status(401).send({
        error: 'Please sign in as a Journalist to update your article'
      });
      return;
    }
    if (
      (user.id === article.userId && user.roleId === 2) ||
      user.roleId === 1
    ) {
      await prisma.article.update({
        where: { id },
        data: { title, content, image, categoryId }
      });
      res.send({ message: 'Article successfully updated' });
    } else {
      res
        .status(401)
        .send({ error: 'You are not allowed to change this article' });
    }
  } catch (err) {
    res
      .status(401)
      .send({ error: 'Please sign in as a Journalist to update your article' });
  }
});

app.delete('/articles/:id', async (req, res) => {
  const id = Number(req.params.id);
  const token = req.headers.authorization || '';
  try {
    const user = await getUserFromToken(token);
    const article = await prisma.article.findUnique({ where: { id } });
    if (!article) {
      res.status(404).send({ error: 'Article not found' });
      return;
    }
    if (!user) {
      res.status(401).send({
        error: 'Please sign in as a Journalist to delete your article'
      });
      return;
    }
    if (
      (user.id === article.userId && user.roleId === 2) ||
      user.roleId === 1
    ) {
      await prisma.article.delete({ where: { id } });
      res.send({ message: 'Article successfully deleted' });
    } else {
      res
        .status(404)
        .send({ error: 'You are not allowed to change this article' });
    }
  } catch (err) {
    res
      .status(401)
      //@ts-ignore
      .send({ error: err.message });
  }
});

app.get('/comments/:articleId', async (req, res) => {
  const articleId = Number(req.params.articleId);
  try {
    const comments = await prisma.comment.findMany({
      where: { articleId },
      include: { user: { select: USER_SELECT } }
    });
    res.send(comments);
  } catch (err) {
    //@ts-ignore
    res.status(400).send({ error: err.messsage });
  }
});

app.post('/comments', async (req, res) => {
  const { content, articleId } = req.body;
  const token = req.headers.authorization || '';
  try {
    const user = await getUserFromToken(token);
    const article = await prisma.article.findUnique({
      where: { id: articleId }
    });
    if (!article) {
      res.status(404).send({ error: 'Article not found' });
      return;
    }
    if (!user) {
      res.status(401).send({
        error: 'Please sign in to comment on this article'
      });
      return;
    }
    await prisma.comment.create({
      data: { content, userId: user.id, articleId }
    });
    const comments = await prisma.comment.findMany({
      where: { articleId },
      include: { user: { select: USER_SELECT } }
    });
    res.send(comments);
  } catch (err) {
    //@ts-ignore
    res.status(400).send({ error: err.messsage });
  }
});

app.patch('/comments/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { content } = req.body;
  const token = req.headers.authorization || '';
  try {
    const user = await getUserFromToken(token);
    const comment = await prisma.comment.findUnique({ where: { id } });
    if (!comment) {
      res.status(404).send({ error: 'Comment not found' });
      return;
    }

    if (!user) {
      res.status(401).send({
        error: 'Please sign in to comment on this article'
      });
      return;
    }
    if (user.id === comment.userId) {
      await prisma.comment.update({
        where: { id },
        data: { content }
      });
      const comments = await prisma.comment.findMany({
        where: { articleId: comment.articleId },
        include: { user: { select: USER_SELECT } }
      });
      res.send(comments);
    } else {
      res.status(401).send({
        error: 'You are not authorized to change this comment'
      });
    }
  } catch (err) {
    //@ts-ignore
    res.status(400).send({ error: err.messsage });
  }
});

app.delete('/comments/:id', async (req, res) => {
  const id = Number(req.params.id);
  const token = req.headers.authorization || '';
  try {
    const user = await getUserFromToken(token);
    const comment = await prisma.comment.findUnique({ where: { id } });
    if (!comment) {
      res.status(404).send({ error: 'Comment not found' });
      return;
    }
    const article = await prisma.article.findUnique({
      where: { id: comment.articleId }
    });
    if (!article) {
      res.status(404).send({ error: 'Article not found' });
      return;
    }
    if (!user) {
      res.status(401).send({
        error: 'Please sign in to delete your comment on this article'
      });
      return;
    }
    if (
      user.id === comment.userId ||
      (user.id === article.userId && user.roleId === 2) ||
      user.roleId === 1
    ) {
      await prisma.comment.delete({
        where: { id }
      });
      const comments = await prisma.comment.findMany({
        where: { articleId: comment.articleId },
        include: { user: { select: USER_SELECT } }
      });
      res.send(comments);
    } else {
      res.status(401).send({
        error: 'You are not authorized to delete this comment'
      });
    }
  } catch (err) {
    //@ts-ignore
    res.status(400).send({ error: err.messsage });
  }
});

app.get('/users', async (req, res) => {
  const token = req.headers.authorization || '';
  try {
    const user = await getUserFromToken(token);
    if (user && user.roleId === 1) {
      const users = await prisma.user.findMany({ select: USER_SELECT });
      res.send({ users });
    } else {
      res.status(401).send({ error: "You're not able view to see all users!" });
    }
  } catch (err) {
    //@ts-ignore
    res.status(400).send({ error: err.message });
  }
});

app.patch('/users/:id', async (req, res) => {
  const id = Number(req.params.id);
  const token = req.headers.authorization || '';
  const { roleId } = req.body;
  try {
    const user = await getUserFromToken(token);
    if (id === 3) {
      res
        .status(401)
        .send({ error: "How dare you try to change the creator's role?" });
      return;
    }
    if (user && user.roleId === 1) {
      await prisma.user.update({ where: { id }, data: { roleId } });
      res.send({ message: 'Changes saved successfully' });
    } else {
      res.status(401).send({ error: "You're not able to change user roles!" });
    }
  } catch (err) {
    res.status(400).send({ error: 'User was not found' });
  }
});

app.get('/users/:username', async (req, res) => {
  const username = req.params.username;
  try {
    const user = await prisma.user.findUnique({
      where: { username },
      select: { ...USER_SELECT, articles: true }
    });
    if (user) {
      user.articles.sort(sortBydate);
      res.send({ user });
    } else {
      res.status(404).send({ error: 'User not found ' });
    }
  } catch (err) {
    //@ts-ignore
    res.status(400).send({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Server up on http://localhost:${PORT}`));
