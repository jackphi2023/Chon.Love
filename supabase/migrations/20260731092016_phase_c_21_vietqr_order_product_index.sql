create index vietqr_orders_product_idx
on private.vietqr_payment_orders(product_id,created_at desc,id);
