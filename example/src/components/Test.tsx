import * as React from 'react';
import { db } from '@usedb-test/core';
import { refetchQueries, useDB } from '@usedb-test/react';
import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';

export const Test = function Test() {
  const { setQuery, status } = useDB();

  const handleSubmit = () => {
    setQuery(
      db.Post.create({
        data: {
          title: 'this is a post',
          author: { authorId: '2', name: 'nishan' },
        },
      })
    );
  };

  useEffect(() => {
    if (status === 'success') {
      // Refetch
      refetchQueries(db.Post.findMany({}));
    }
  }, [status]);

  return (
    <div>
      <button disabled={status === 'loading'} onClick={handleSubmit}>
        {status === 'loading' ? 'Creating' : 'Create a Post'}
      </button>
      <PostList />
    </div>
  );
};

const PostList = observer(() => {
  const { data, status, error } = useDB(db.Post.findMany({}));

  if (status === 'loading') {
    return <div>Loading posts...</div>;
  }

  if (status === 'error') {
    return <div>{error.message}</div>;
  }

  if (data) {
    return (
      <div>
        {data.data.map(item => {
          return (
            <div key={item.id}>
              <PostItem post={item} />
            </div>
          );
        })}
      </div>
    );
  }

  return null;
});

const PostItem = observer(({ post }: any) => {
  const { setQuery, status } = useDB();

  useEffect(() => {
    if (status === 'success') {
      refetchQueries(db.Post.collection);
    }
  }, [status]);

  return (
    <div>
      {post.title}
      {post.author?.name}
      <button
        onClick={() =>
          setQuery(
            db.Post.update({
              where: { id: post.id },
              data: { title: 'new post' },
            }),
            { optimistic: true }
          )
        }
        disabled={status === 'loading'}
      >
        update title
      </button>

      <button
        onClick={() =>
          setQuery(
            db.Post.delete({
              where: { id: post.id },
            }),
            { optimistic: true }
          )
        }
        disabled={status === 'loading'}
      >
        delete
      </button>
    </div>
  );
});

// 1. Define API for ORM on FE. Check Prisma and laravel, RoR.
// 2. Define database in the NewsChat project.
// 3. Custom Actions and typing support on results
// 4. Fetching relationships and selected properties
// 5. Calling mutations should normalize and update in cache db

// Change useDBQuery, useDBMutation -> useDB
// mutate API refactor, pass db.Post.create({ data: { id: '1', title: 'this is a post' } }) in mutate function
// Replace refetch to fetch and add filter function

// Current implementation
// 1. On Create - Refetch all
// 2. On Update - Update single entity on success/optimistic
// 3. On Delete - Refetch all
// 4. On Read - Cache first
