﻿define([
    'background/collection/playlists',
    'background/collection/streamItems',
    'background/model/user',
    'background/model/buttons/playPauseButton',
    'common/enum/listItemType',
    'common/model/utility',
    'foreground/collection/contextMenuItems',
    'foreground/view/deleteButtonView',
    'foreground/view/saveToPlaylistButtonView',
    'foreground/view/playInStreamButtonView',
    'text!template/streamItem.html',
    'background/model/player',
    'common/enum/playerState',
], function (Playlists, StreamItems, User, PlayPauseButton, ListItemType, Utility, ContextMenuItems, DeleteButtonView, SaveToPlaylistButtonView, PlayInStreamButtonView, StreamItemTemplate, Player, PlayerState) {
    'use strict';

    var StreamItemView = Backbone.Marionette.Layout.extend({

        className: 'list-item stream-item multi-select-item',

        template: _.template(StreamItemTemplate),

        templateHelpers: function () {
            return {
                hdMessage: chrome.i18n.getMessage('hd'),
                playMessage: chrome.i18n.getMessage('play'),
                instant: this.instant
            };
        },

        instant: false,

        attributes: function () {
            return {
                'data-id': this.model.get('id'),
                'data-type': ListItemType.StreamItem
            };
        },

        events: {
            'contextmenu': 'showContextMenu',
            'dblclick': 'activateOrToggleState'
        },

        modelEvents: {
            'change:active': 'setActiveClass',
            'change:selected': 'setSelectedClass',
            'destroy': 'remove'
        },

        ui: {
            imageThumbnail: 'img.item-thumb'
        },

        regions: {
            deleteRegion: '.delete-region',
            saveToPlaylistRegion: '.save-to-playlist-region',
            playInStreamRegion: '.play-in-stream-region'
        },

        onShow: function () {
            //  If the stream item is active -- ensure it is instantly visible.
            if (this.model.get('active')) {
                //  Pass 0 into scrollIntoView to have no animation/show instantly.
                this.$el.scrollIntoView(0);
            }

            this.applyTooltips();
        },

        onRender: function () {
            this.setActiveClass();
            this.setSelectedClass();

            this.playInStreamRegion.show(new PlayInStreamButtonView({
                model: this.model.get('video')
            }));

            this.deleteRegion.show(new DeleteButtonView({
                model: this.model
            }));

            this.saveToPlaylistRegion.show(new SaveToPlaylistButtonView({
                model: this.model.get('video')
            }));
        },

        initialize: function (options) {
            this.instant = options && options.instant !== undefined ? options.instant : this.instant;
        },

        activateOrToggleState: function () {
            if (!this.model.get('active')) {
                this.model.set('active', true);
            } else {
                PlayPauseButton.tryTogglePlayerState();
            }
        },

        //  Force the view to reflect the model's active class. It's important to do this here, and not through render always, because
        //  render will cause the lazy-loaded image to be reset.
        setActiveClass: function () {
            var active = this.model.get('active');
            this.$el.toggleClass('active', active);

            if (active) {
                this.$el.scrollIntoView();
            }
        },

        //  TODO: Maybe keep DRY with video search results and playlist items by introducing a "Selectable" list item view.
        setSelectedClass: function () {
            this.$el.toggleClass('selected', this.model.get('selected'));
        },

        showContextMenu: function (event) {

            //  Whenever a context menu is shown -- set preventDefault to true to let foreground know to not reset the context menu.
            event.preventDefault();
            var self = this;

            var userSignedIn = User.get('signedIn');

            var activePlaylist = Playlists.getActivePlaylist();
            var videoAlreadyExists = false;

            if (userSignedIn) {
                videoAlreadyExists = activePlaylist.get('items').videoAlreadyExists(self.model.get('video'));
            }

            var saveTitle = '';

            if (userSignedIn && videoAlreadyExists) {
                saveTitle = chrome.i18n.getMessage('duplicatesNotAllowed');
            } else if (!userSignedIn) {
                saveTitle = chrome.i18n.getMessage('cantSaveNotSignedIn');
            }

            ContextMenuItems.reset([{
                    text: chrome.i18n.getMessage('save'),
                    title: saveTitle,
                    disabled: !userSignedIn || videoAlreadyExists,
                    onClick: function () {
                        activePlaylist.addByVideo(self.model.get('video'));
                    }
                }, {
                    text: chrome.i18n.getMessage('copyUrl'),
                    onClick: function () {

                        chrome.extension.sendMessage({
                            method: 'copy',
                            text: self.model.get('video').get('url')
                        });

                    }
                }, {
                    text: chrome.i18n.getMessage('copyTitleAndUrl'),
                    onClick: function() {

                        chrome.extension.sendMessage({
                            method: 'copy',
                            text: '"' + self.model.get('title') + '" - ' + self.model.get('video').get('url')
                        });

                    }
                }, {
                    text: chrome.i18n.getMessage('delete'),
                    onClick: function () {
                        self.model.destroy();
                    }
                }, {
                    text: chrome.i18n.getMessage('banUntilClear'),
                    disabled: StreamItems.getRelatedVideos().length < 5,
                    onClick: function () {
                        StreamItems.ban(self.model);
                        self.model.destroy();
                    }
                }, {
                    text: chrome.i18n.getMessage('watchOnYouTube'),
                    onClick: function () {
                        if( Player.get('state') === PlayerState.Playing )
                        {
                            Player.pause();
                        }
                        var url = self.model.get('video').get('url');
                        if ( Player.get('loadedVideoId') ===  self.model.get('video').get('id') )
                        {
                            url += '?t=' + Player.get('currentTime') + 's';
                        }
                        chrome.tabs.create({
                            url:  url
                        });
                      }
                  }]
            );

        }
    });

    return StreamItemView;
});
