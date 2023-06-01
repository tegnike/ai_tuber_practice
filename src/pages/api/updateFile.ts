import { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path';

const filePath = path.join(process.cwd(), 'playground', 'index.html');

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { type, code } = req.body;

  switch (type) {
    case 'add':
      fs.appendFile(filePath, code, (err) => {
        if (err) {
          res.status(500).send('Error writing to file');
          return;
        }
        res.status(200).send('Code has been added to the file');
      });
      break;
    case 'clear':
      fs.writeFile(filePath, '', (err) => {
        if (err) {
          res.status(500).send('Error clearing the file');
          return;
        }
        res.status(200).send('File has been cleared');
      });
      break;
    default:
      res.status(400).send('Invalid type');
  }
}
