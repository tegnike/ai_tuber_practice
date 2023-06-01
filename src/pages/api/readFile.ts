import { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path';

const filePath = path.join(process.cwd(), 'playground', 'index.html');

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      res.status(500).send('Error reading from file');
      return;
    }
    res.status(200).send(data);
  });
}
