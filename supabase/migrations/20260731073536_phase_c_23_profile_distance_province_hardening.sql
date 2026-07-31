do $$
declare
  v_definition text;
  v_pattern constant text := 'viewer_profile.province_id is not distinct from p.province_id';
  v_replacement constant text := 'p.province_id is not null and viewer_profile.province_id = p.province_id';
begin
  select pg_get_functiondef('public.get_profile_viewer(text)'::regprocedure) into v_definition;
  if strpos(v_definition,v_pattern)=0 then
    raise exception 'get_profile_viewer_distance_pattern_not_found';
  end if;
  execute replace(v_definition,v_pattern,v_replacement);
end
$$;

comment on function public.get_profile_viewer(text) is 'Authenticated profile presentation. Basic fields remain visible; Creator Activity and derived album are gated separately. Distance requires the same non-null province and fresh consented locations.';
