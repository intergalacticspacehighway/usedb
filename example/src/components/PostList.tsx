import * as React from 'react';
import { db } from '@usedb/core';
import { useDBv2 } from '@usedb/react';
import { observer } from 'mobx-react';
import { db as cacheDB } from '../../dbConfig';

// Pagination
// 1. Cursor
// 2. Skip/Take

export const PostList = observer(() => {
  const { data, status, error, setQuery } = useDBv2(
    db.Post.findMany({
      where: {
        user: { id: 1 },
      },
      cursor: {
        id: undefined,
      },
      take: 5,
    })
  );

  const refetch = () => {
    setQuery(
      db.Post.findMany({
        where: {
          user: { id: 1 },
        },
        cursor: {
          id: undefined,
        },
        take: 5,
      })
    );
  };

  const loadMore = () => {
    // setCursor(data.pagination.cursor.id);
    setQuery(
      db.Post.findMany({
        where: {
          user: { id: 1 },
        },
        cursor: {
          id: data.pagination.cursor.id,
        },
        take: 5,
      })
    );
  };

  const isLoadingMore =
    status === 'loading' && data && data.pagination.cursor.id !== undefined;

  if (status === 'loading' && !isLoadingMore) {
    return <div>Loading posts...</div>;
  }

  if (data && data.data.length === 0) {
    return (
      <div>
        No posts found. Please write one and refetch this API.{' '}
        <button onClick={refetch}>Refetch</button>
      </div>
    );
  }

  if (data) {
    return (
      <div>
        {data.data.map((p: any) => {
          return (
            <div key={p.id}>
              {p.text} by{' '}
              <span style={{ color: 'red' }}>{p.user.username}</span>
              <PostLike post={p} />
              <DeletePostButton post={p} />
            </div>
          );
        })}
        {isLoadingMore ? (
          <div>loading more...</div>
        ) : (
          <>
            <button disabled={data.pagination.last} onClick={loadMore}>
              Load more
            </button>
          </>
        )}
        <div>
          Refresh. Optimistic updates on creation/deletion not supported yet
          <button onClick={refetch}>Refetch</button>
        </div>
      </div>
    );
  }
  return null;
});

const PostLike = observer(({ post }: any) => {
  const { setQuery, status, data } = useDBv2();
  const prevVal = React.useRef(post.isLiked);
  const handleToggleLike = () => {
    if (status === 'loading') {
      return;
    }
    setQuery(
      db.Post.update({
        data: { isLiked: !post.isLiked },
        where: { id: post.id },
      })
    );
  };

  React.useEffect(() => {
    // if (status === 'loading') {
    //   cacheDB._save('Post', {
    //     ...post,
    //     isLiked: !post.isLiked,
    //   });
    // } else if (status === 'error') {
    //   cacheDB._save('Post', {
    //     ...post,
    //     isLiked: prevVal.current,
    //   });
    // } else if (status === 'success') {
    //   prevVal.current = post.isLiked;
    // }
  }, [status]);

  return (
    <div>
      <button onClick={handleToggleLike}>
        {post.isLiked ? 'Liked' : 'Like'}
      </button>
    </div>
  );
});

export const DeletePostButton = observer(function DeletePost({ post }: any) {
  const { data, status, setQuery } = useDBv2();

  const handleDeletePost = () => {
    setQuery(db.Post.delete({ where: { id: post.id } }));
  };

  React.useEffect(() => {
    // if (status === 'loading') {
    //   cacheDB.runInAction(() => {
    //     const currentCache = cacheDB.queryCache.get('posts');
    //     const pages = currentCache.pages.filter(d => d.id !== post.id);
    //     cacheDB.queryCache.set('posts', { ...currentCache, pages });
    //   });
    // }
  }, [status]);

  return (
    <div>
      <button onClick={handleDeletePost} disabled={status === 'loading'}>
        Delete Post
      </button>
    </div>
  );
});
