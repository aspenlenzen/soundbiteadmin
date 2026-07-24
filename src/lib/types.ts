export type RestaurantRef = {
  restaurant_name: string | null;
  city: string | null;
  google_maps_uri: string | null;
};

export type Rating = {
  id: number;
  created_at: string;
  google_place_id: string;
  sound_rating: number;
  comment: string | null;
  room: string | null;
  rated_datetime: string | null;
  tags: string[] | null;
  user_id: string;
  rated_timezone: string | null;
  restaurant: RestaurantRef | null;
};

export type RestaurantOption = {
  google_place_id: string;
  restaurant_name: string | null;
  city: string | null;
};

export type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
};
