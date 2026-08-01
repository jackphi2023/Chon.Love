'use client';

import {
  formatGiftHeartPrice,
  listActiveGiftCatalog,
  type GiftCatalogItem,
} from '@myfan/supabase';
import { useCallback, useEffect, useState } from 'react';
import { getPublicWebSupabaseClient } from '../../src/lib/supabase';

type CatalogState =
  | { status: 'loading'; gifts: GiftCatalogItem[] }
  | { status: 'ready'; gifts: GiftCatalogItem[] }
  | { status: 'error'; gifts: GiftCatalogItem[] };

export function PublicGiftCatalog() {
  const [state, setState] = useState<CatalogState>({ status: 'loading', gifts: [] });
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((current) => current + 1), []);

  useEffect(() => {
    let active = true;
    const client = getPublicWebSupabaseClient();
    if (!client) {
      setState({ status: 'error', gifts: [] });
      return () => {
        active = false;
      };
    }

    setState((current) => ({ status: 'loading', gifts: current.gifts }));
    void listActiveGiftCatalog(client)
      .then((gifts) => {
        if (active) setState({ status: 'ready', gifts });
      })
      .catch(() => {
        if (active) setState({ status: 'error', gifts: [] });
      });

    return () => {
      active = false;
    };
  }, [reloadToken]);

  if (state.status === 'loading' && state.gifts.length === 0) {
    return (
      <div aria-busy="true" aria-label="Đang tải danh mục quà" className="giftPublicGrid">
        {Array.from({ length: 8 }, (_, index) => (
          <div className="giftPublicCard giftSkeleton" key={index}>
            <span className="giftSkeletonIcon" />
            <span className="giftSkeletonLine" />
            <span className="giftSkeletonPrice" />
          </div>
        ))}
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="giftCatalogState" role="alert">
        <strong>Không thể tải danh mục quà</strong>
        <p>Hãy kiểm tra kết nối hoặc cấu hình public Supabase rồi thử lại.</p>
        <button className="secondary giftRetry" onClick={reload} type="button">Thử lại</button>
      </div>
    );
  }

  if (state.gifts.length === 0) {
    return (
      <div className="giftCatalogState">
        <strong>Danh mục đang trống</strong>
        <p>Các quà đang tạm ẩn hoặc chưa được cấu hình.</p>
      </div>
    );
  }

  return (
    <div className="giftPublicGrid">
      {state.gifts.map((gift) => (
        <article
          aria-label={`${gift.name_vi}, ${formatGiftHeartPrice(gift)}`}
          className="giftPublicCard"
          key={gift.id}
        >
          <span aria-hidden="true" className="giftPublicIcon">{gift.icon_emoji}</span>
          <h2>{gift.name_vi}</h2>
          <p className="giftPublicPrice">{formatGiftHeartPrice(gift)}</p>
        </article>
      ))}
    </div>
  );
}
