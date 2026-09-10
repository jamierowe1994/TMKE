-- World's Biggest Coffee Morning, as Dani wrote it on 10 September 2026.
update public.content_prompts
set angle = 'Show your support for a Coffee Morning near you.',
    brief = 'Macmillan''s Coffee Morning is an easy opportunity to support something happening in your local community and encourage your audience to get involved.',
    detail = E'Going along?\nShare a photo from the Coffee Morning and tag the organisers.\nKnow one happening locally?\nShare the details and help give it some extra visibility.\nNothing planned nearby?\nUse the post to raise awareness and point people towards getting involved.',
    updated_at = now()
where kind = 'dated' and name = 'World''s Biggest Coffee Morning';
